import { Model } from './model';

export interface Client extends Model {
    userId: string;

    operatingSystem: string;
    clientVersion?: string;
}
