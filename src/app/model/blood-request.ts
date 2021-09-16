import { BloodGroup } from './blood-group';
import { Model } from './model';
import { RhesusFactor } from './rhesus-factor';

export interface BloodRequest extends Model {
    rhesusFactor: RhesusFactor;
    bloodGroup: BloodGroup;
    activated: boolean;
    userId: string;
}
