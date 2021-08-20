import { Model } from './model';

export interface Match extends Model {
    dispatchId: string;
    clientId: string;

    accepted: boolean;
    applied: boolean;
}
