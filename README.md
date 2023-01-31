# Hardhat Google Cloud KMS Signer

This plugin signs Ethereum transaction using KMS key during deployments.

- Inspired by [@rumblefishdev/hardhat-kms-signer](https://github.com/rumblefishdev/hardhat-kms-signer)

## Usage

It's assumed that you have AWS access configured and your role perform kms:sign using KMS key.

In `hardhat.config.ts` do:

```
import "@microverse-dev/hardhat-gcp-kms-signer";

...

const config: HardhatUserConfig = {
  ...
  networks: {
    goerli: {
      url: "https://goerli.infura.io/v3/{infura-key}",
      kmsResourceName: "projects/{project}/locations/asia1/keyRings/{key-ring-name}/cryptoKeys/{key-name}/cryptoKeyVersions/{version}",
      chainId: 5,
    },
  }
  ...
}
```

## License

- hardhat: MIT - See [LICENSE][hardhet-license] for more information.
- @microverse-dev/hardhat-gcp-kms-signer: MIT - See [LICENSE][license] for more information.

[hardhet-license]: https://github.com/NomicFoundation/hardhat/blob/main/LICENSE
[license]: LICENSE
