import { Kind } from './kind';
import { Model } from './model';

export interface Request extends Model {
    clientId: string;

    radius: string;
    kind: Kind;
}
