import { BloodGroup } from './blood-group';
import { Model } from './model';
import { RhesusFactor } from './rhesus-factor';

export interface BloodRequestDispatch extends Model {
    outcome?: Map<BloodGroup, Map<RhesusFactor | '*', Map<string, number>>>;
    requestId: string;
}
