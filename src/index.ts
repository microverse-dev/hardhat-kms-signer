import { KMSSigner } from './signer';
import './type-extensions';
import { extendConfig, extendEnvironment, HardhatUserConfig } from 'hardhat/config';
import { BackwardsCompatibilityProviderAdapter } from 'hardhat/internal/core/providers/backwards-compatibility';
import { ChainIdValidatorProvider } from 'hardhat/internal/core/providers/chainId';
import {
  AutomaticGasPriceProvider,
  AutomaticGasProvider,
} from 'hardhat/internal/core/providers/gas-providers';
import { HttpProvider } from 'hardhat/internal/core/providers/http';
import { lazyObject } from 'hardhat/plugins';
import {
  EIP1193Provider,
  HardhatConfig,
  HardhatRuntimeEnvironment,
  HttpNetworkUserConfig,
} from 'hardhat/types';

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  const userNetworks = userConfig.networks;
  if (userNetworks == null) {
    return;
  }

  for (const networkName in userNetworks) {
    if (networkName === 'hardhat') {
      continue;
    }
    const network = userNetworks[networkName]!;
    if (network.kmsResourceName) {
      config.networks[networkName].kmsResourceName = network.kmsResourceName;
    }
  }
});

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  if (hre.network.name !== 'hardhat' && hre.network.config.kmsResourceName) {
    hre.network.provider = lazyObject(() => {
      const httpNetConfig = hre.network.config as HttpNetworkUserConfig;
      const httpProvider = new HttpProvider(
        httpNetConfig.url!,
        hre.network.name,
        httpNetConfig.httpHeaders,
        httpNetConfig.timeout,
      );

      let wrappedProvider: EIP1193Provider;
      wrappedProvider = new KMSSigner(httpProvider, hre.network.config.kmsResourceName!);
      wrappedProvider = new AutomaticGasProvider(wrappedProvider, hre.network.config.gasMultiplier);
      wrappedProvider = new AutomaticGasPriceProvider(wrappedProvider);
      wrappedProvider = new ChainIdValidatorProvider(wrappedProvider, hre.network.config.chainId!);

      return new BackwardsCompatibilityProviderAdapter(wrappedProvider);
    });
  }
});
