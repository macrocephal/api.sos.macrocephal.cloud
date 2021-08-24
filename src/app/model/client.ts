import { Model } from './model';

export interface Client extends Model {
    userId: string;

    userAgent: string;
}
