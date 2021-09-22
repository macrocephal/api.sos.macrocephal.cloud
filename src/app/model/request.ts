import { Model } from './model';

export interface Request extends Model {
    active: boolean;
    userId: string;
}
