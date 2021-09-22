import { BloodGroup } from './blood-group';
import { RhesusFactor } from './rhesus-factor';

export interface BloodRequest extends Request {
    rhesusFactor: RhesusFactor;
    bloodGroup: BloodGroup;
}
