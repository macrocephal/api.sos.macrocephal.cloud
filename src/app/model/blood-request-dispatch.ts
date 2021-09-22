import { BloodGroup } from './blood-group';
import { Model } from './model';
import { RhesusFactor } from './rhesus-factor';

export interface BloodRequestDispatch extends Model {
    outcome?: {
        [bloodGroup in BloodGroup]?: {
            [rhesusFactor in RhesusFactor | '*']?: Record<string, number>;
        };
    };
    requestId: string;
}
