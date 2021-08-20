import { Kind } from './kind';
import { Model } from './model';

export interface Request extends Model {
    clientId: string;

    maxRadius: string;
    kind: Kind;
}
