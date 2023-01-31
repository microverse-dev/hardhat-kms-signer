import 'hardhat/types/config';

declare module 'hardhat/types/config' {
  export interface HttpNetworkUserConfig {
    kmsResourceName?: string;
  }

  export interface HardhatNetworkUserConfig {
    kmsResourceName?: string;
  }

  export interface HttpNetworkConfig {
    kmsResourceName?: string;
  }

  export interface HardhatNetworkConfig {
    kmsResourceName?: string;
  }
}
