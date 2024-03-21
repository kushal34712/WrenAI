import axios, { AxiosError } from 'axios';
import { Manifest } from '../mdl/type';
import { getLogger } from '@server/utils';

const logger = getLogger('WrenEngineAdaptor');
logger.level = 'debug';

export enum WrenEngineDeployStatusEnum {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface WrenEngineDeployStatusResponse {
  systemStatus: string;
  version: string;
}

export interface DeployResponse {
  status: WrenEngineDeployStatusEnum;
  error?: string;
}

enum WrenEngineSystemStatus {
  READY = 'READY',
  PREPARE = 'PREPARE',
}

interface DeployPayload {
  manifest: Manifest;
  version: string;
}

export interface deployData {
  manifest: Manifest;
  hash: string;
}

export interface IWrenEngineAdaptor {
  deploy(deployData: deployData): Promise<DeployResponse>;
}

export class WrenEngineAdaptor implements IWrenEngineAdaptor {
  private readonly wrenEngineBaseEndpoint: string;
  constructor({ wrenEngineEndpoint }: { wrenEngineEndpoint: string }) {
    this.wrenEngineBaseEndpoint = wrenEngineEndpoint;
  }
  public async deploy(deployData: deployData): Promise<DeployResponse> {
    const { manifest, hash } = deployData;
    const deployPayload = { manifest, version: hash } as DeployPayload;

    try {
      // skip if the model has been deployed
      const resp = await this.getDeployStatus();
      if (resp.version === hash) {
        return { status: WrenEngineDeployStatusEnum.SUCCESS };
      }

      // start deploy to wren engine
      await axios.post(
        `${this.wrenEngineBaseEndpoint}/v1/mdl/deploy`,
        deployPayload,
      );
      const deploySuccess = await this.waitDeployFinished(hash);
      if (deploySuccess) {
        logger.debug(`WrenEngine: Deploy wren engine success, hash: ${hash}`);
        return { status: WrenEngineDeployStatusEnum.SUCCESS };
      } else {
        return {
          status: WrenEngineDeployStatusEnum.FAILED,
          error: 'WrenEngine: Deploy wren engine failed or timeout',
        };
      }
    } catch (err: any) {
      logger.debug(`Got error when deploying to wren engine: ${err.message}`);
      return {
        status: WrenEngineDeployStatusEnum.FAILED,
        error: `WrenEngine Error, deployment hash:${hash}: ${err.message}`,
      };
    }
  }

  private async waitDeployFinished(version) {
    let deploySuccess = false;
    // timeout after 20 seconds
    for (let waitTime = 1; waitTime <= 6; waitTime++) {
      try {
        const deployStatus = await this.getDeployStatus();
        const { systemStatus, version: deployVersion } = deployStatus;
        if (
          systemStatus === WrenEngineSystemStatus.READY &&
          version == deployVersion
        ) {
          deploySuccess = true;
          break;
        }
      } catch (err: any) {
        logger.debug(
          `WrenEngine: Got error when waiting for deploy finished: ${err.message}`,
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
    }
    return deploySuccess;
  }

  private async getDeployStatus(): Promise<WrenEngineDeployStatusResponse> {
    try {
      const res = await axios.get(
        `${this.wrenEngineBaseEndpoint}/v1/mdl/status`,
      );
      return res.data as WrenEngineDeployStatusResponse;
    } catch (err: any) {
      logger.debug(
        `WrenEngine: Got error when getting deploy status: ${err.message}`,
      );
      throw err;
    }
  }
}
