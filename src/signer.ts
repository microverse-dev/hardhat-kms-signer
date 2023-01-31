import { KeyManagementServiceClient } from '@google-cloud/kms';
import * as asn1 from 'asn1.js';
import * as BN from 'bn.js';
import { BigNumber, utils } from 'ethers';
import { rpcTransactionRequest } from 'hardhat/internal/core/jsonrpc/types/input/transactionRequest';
import { validateParams } from 'hardhat/internal/core/jsonrpc/types/input/validation';
import { ProviderWrapperWithChainId } from 'hardhat/internal/core/providers/chainId';
import { EIP1193Provider, RequestArguments } from 'hardhat/types';
import KeyEncoder from 'key-encoder';

const EcdsaSigAsnParse: { decode: (asnStringBuffer: Buffer, format: 'der') => { r: BN; s: BN } } =
  asn1.define('EcdsaSig', function (this: any) {
    this.seq().obj(this.key('r').int(), this.key('s').int());
  });

const EcdsaPubKey = asn1.define('EcdsaPubKey', function (this: any) {
  this.seq().obj(
    this.key('algo').seq().obj(this.key('a').objid(), this.key('b').objid()),
    this.key('pubKey').bitstr(),
  );
});

export class KMSSigner extends ProviderWrapperWithChainId {
  public kmsResourceName: string;
  public ethAddress?: string;

  constructor(provider: EIP1193Provider, kmsResourceName: string) {
    super(provider);
    this.kmsResourceName = kmsResourceName;
  }

  public async request(args: RequestArguments) {
    const method = args.method;
    const params = this._getParams(args);
    const senderAddress = await this._getSenderAddress();
    if (method === 'eth_sendTransaction') {
      const [txRequest] = validateParams(params, rpcTransactionRequest);
      const baseTx = await utils.resolveProperties(txRequest);

      const unsignedTx: utils.UnsignedTransaction = {
        chainId: await this._getChainId(),
        data: baseTx.data,
        gasLimit: baseTx.gas,
        gasPrice: baseTx.gasPrice,
        nonce: Number(baseTx.nonce ? baseTx.nonce : await this._getNonce(senderAddress)),
        type: 2,
        to: baseTx.to && toHexString(baseTx.to),
        value: baseTx.value && BigNumber.from(baseTx.value),
        maxFeePerGas: baseTx.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: baseTx.maxPriorityFeePerGas?.toString(),
      };

      // XXX: eip1193には未対応のため、type=0を明示する。
      if (unsignedTx.maxFeePerGas === undefined && unsignedTx.maxPriorityFeePerGas === undefined) {
        unsignedTx.type = 0;
        delete unsignedTx.maxFeePerGas;
        delete unsignedTx.maxPriorityFeePerGas;
      }

      const serializedTx = utils.serializeTransaction(unsignedTx as utils.UnsignedTransaction);
      const signature = await this._signDigest(utils.keccak256(serializedTx));

      return this._wrappedProvider.request({
        method: 'eth_sendRawTransaction',
        params: [utils.serializeTransaction(unsignedTx as utils.UnsignedTransaction, signature)],
      });
    } else if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
      return [senderAddress];
    }

    return this._wrappedProvider.request(args);
  }

  private async _getSenderAddress(): Promise<string> {
    if (!this.ethAddress) {
      this.ethAddress = await requestAddressFromKMS(this.kmsResourceName);
    }
    return this.ethAddress;
  }

  private async _getNonce(address: string): Promise<bigint> {
    const response = (await this._wrappedProvider.request({
      method: 'eth_getTransactionCount',
      params: [address, 'pending'],
    })) as any;

    return BigInt(response);
  }

  private async _signDigest(digestString: string): Promise<string> {
    const digestBuffer = Buffer.from(utils.arrayify(digestString));
    const { r, s } = await requestSignatureFromKMS(digestBuffer, this.kmsResourceName);
    const senderAddress = await this._getSenderAddress();
    for (let recoveryParam = 0; recoveryParam < 2; recoveryParam++) {
      const address = utils.recoverAddress(digestBuffer, { r, s, recoveryParam }).toLowerCase();
      if (address === senderAddress) {
        return utils.joinSignature({ r, s, v: recoveryParam });
      }
    }

    throw new Error(`Failed to calculate recovery param: ${senderAddress}`);
  }
}

const secp256k1N = new BN('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141', 16);
const secp256k1halfN = secp256k1N.div(new BN(2));

const keyEncoder = new KeyEncoder('secp256k1');

const requestAddressFromKMS = async (kmsResourceName: string) => {
  const kms = new KeyManagementServiceClient();
  const [kmsPublicKey] = await kms.getPublicKey({ name: kmsResourceName });

  if (!kmsPublicKey || !kmsPublicKey.pem) throw new Error(`Can not find key: ${kmsResourceName}`);

  const block = keyEncoder.encodePublic(kmsPublicKey.pem, 'pem', 'der');
  const res = EcdsaPubKey.decode(Buffer.from(block, 'hex'), 'der') as any;
  const pubKeyBuffer: Buffer = res.pubKey.data;

  const publicKey = pubKeyBuffer.subarray(1, pubKeyBuffer.length);

  return `0x${utils.keccak256(publicKey).slice(-40)}`;
};

export async function requestSignatureFromKMS(digest: Buffer, kmsResourceName: string) {
  const kms = new KeyManagementServiceClient();
  const [asymmetricSignResponse] = await kms.asymmetricSign({
    name: kmsResourceName,
    digest: {
      sha256: digest,
    },
  });

  if (!asymmetricSignResponse || !asymmetricSignResponse.signature) {
    throw new Error(`GCP KMS call failed`);
  }

  const { r, s } = EcdsaSigAsnParse.decode(asymmetricSignResponse.signature as Buffer, 'der');

  return { r: toHexString(r)!, s: toHexString(s.gt(secp256k1halfN) ? secp256k1N.sub(s) : s) };
}

export function toHexString(value: BN | Buffer | undefined): string | undefined {
  if (value == null) {
    return;
  }

  return `0x${value.toString('hex')}`;
}
