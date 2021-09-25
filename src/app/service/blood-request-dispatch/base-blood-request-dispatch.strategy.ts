import { BloodGroup } from '../../model/blood-group';
import { BloodRequest } from '../../model/blood-request';
import { RhesusFactor } from '../../model/rhesus-factor';
import { Container } from './../../../container';
import { BloodRequestDispatch } from './../../model/blood-request-dispatch';
import { WithApplication } from './../../with-application';
import { ANegativeBloodRequestDispatch } from './a-negative-blood-request-dispatch.strategy';
import { APositiveBloodRequestDispatch } from './a-positive-blood-request-dispatch.strategy';
import { ABNegativeBloodRequestDispatch } from './ab-negative-blood-request-dispatch.strategy';
import { ABPositiveBloodRequestDispatch } from './ab-positive-blood-request-dispatch.strategy';
import { BNegativeBloodRequestDispatch } from './b-negative-blood-request-dispatch.strategy';
import { BPositiveBloodRequestDispatch } from './b-positive-blood-request-dispatch.strategy';
import { BloodRequestDispatchStrategy } from './blood-request-dispatch.strategy';
import { ONegativeBloodRequestDispatch } from './o-negative-blood-request-dispatch.strategy';
import { OPositiveBloodRequestDispatch } from './o-positive-blood-request-dispatch.strategy';

export abstract class BaseBloodRequestDispatchStrategy extends WithApplication implements BloodRequestDispatchStrategy {
    protected readonly radius = [50_000, 'm'] as const;
    protected readonly maximum = 50 as const;

    static resolve(request: BloodRequest, container: Container): BaseBloodRequestDispatchStrategy {
        switch (request.bloodGroup) {
            case BloodGroup.A:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? new ANegativeBloodRequestDispatch(container)
                    : new APositiveBloodRequestDispatch(container);
            case BloodGroup.B:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? new BNegativeBloodRequestDispatch(container)
                    : new BPositiveBloodRequestDispatch(container);
            case BloodGroup.O:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? new ONegativeBloodRequestDispatch(container)
                    : new OPositiveBloodRequestDispatch(container);
            case BloodGroup.AB:
                return RhesusFactor.NEGATIVE === request.rhesusFactor
                    ? new ABNegativeBloodRequestDispatch(container)
                    : new ABPositiveBloodRequestDispatch(container);

            default:
                throw new Error(`Unsupported opperation yet [bloodGroup=${request.bloodGroup}] [rhesusFactor=${request.rhesusFactor}]`);
        }
    }

    constructor(container: Container) {
        super(container);
    }

    protected keys(requestId: string, dispatchId: string) {
        return {
            GROUP_A: this.key.donors.blood.group(BloodGroup.A),
            GROUP_B: this.key.donors.blood.group(BloodGroup.B),
            GROUP_O: this.key.donors.blood.group(BloodGroup.O),
            GROUP_AB: this.key.donors.blood.group(BloodGroup.AB),
            NEIGHBOURHOOD: this.key.of.neighbourhood(dispatchId),
            RHESUS_NEGATIVE: this.key.donors.blood.rhesus(RhesusFactor.NEGATIVE),
            RHESUS_POSITIVE: this.key.donors.blood.rhesus(RhesusFactor.POSITIVE),
            DISPATCH_A: this.key.donors.blood.dispatch(dispatchId, BloodGroup.A),
            DISPATCH_A_NEGATIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.A, RhesusFactor.NEGATIVE),
            DISPATCH_A_POSITIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.A, RhesusFactor.POSITIVE),
            DISPATCH_B: this.key.donors.blood.dispatch(dispatchId, BloodGroup.B),
            DISPATCH_B_NEGATIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.B, RhesusFactor.NEGATIVE),
            DISPATCH_B_POSITIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.B, RhesusFactor.POSITIVE),
            DISPATCH_O: this.key.donors.blood.dispatch(dispatchId, BloodGroup.O),
            DISPATCH_O_NEGATIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.O, RhesusFactor.NEGATIVE),
            DISPATCH_O_POSITIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.O, RhesusFactor.POSITIVE),
            DISPATCH_AB: this.key.donors.blood.dispatch(dispatchId, BloodGroup.AB),
            DISPATCH_AB_NEGATIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.AB, RhesusFactor.NEGATIVE),
            DISPATCH_AB_POSITIVE: this.key.donors.blood.dispatch(dispatchId, BloodGroup.AB, RhesusFactor.POSITIVE),
            REQUEST_A: this.key.donors.blood.request(requestId, BloodGroup.A),
            REQUEST_A_NEGATIVE: this.key.donors.blood.request(requestId, BloodGroup.A, RhesusFactor.NEGATIVE),
            REQUEST_A_POSITIVE: this.key.donors.blood.request(requestId, BloodGroup.A, RhesusFactor.POSITIVE),
            REQUEST_B: this.key.donors.blood.request(requestId, BloodGroup.B),
            REQUEST_B_NEGATIVE: this.key.donors.blood.request(requestId, BloodGroup.B, RhesusFactor.NEGATIVE),
            REQUEST_B_POSITIVE: this.key.donors.blood.request(requestId, BloodGroup.B, RhesusFactor.POSITIVE),
            REQUEST_O: this.key.donors.blood.request(requestId, BloodGroup.O),
            REQUEST_O_NEGATIVE: this.key.donors.blood.request(requestId, BloodGroup.O, RhesusFactor.NEGATIVE),
            REQUEST_O_POSITIVE: this.key.donors.blood.request(requestId, BloodGroup.O, RhesusFactor.POSITIVE),
            REQUEST_AB: this.key.donors.blood.request(requestId, BloodGroup.AB),
            REQUEST_AB_NEGATIVE: this.key.donors.blood.request(requestId, BloodGroup.AB, RhesusFactor.NEGATIVE),
            REQUEST_AB_POSITIVE: this.key.donors.blood.request(requestId, BloodGroup.AB, RhesusFactor.POSITIVE),
        } as const;
    }

    abstract dispatch(pros: [request: BloodRequest, lontitude: number, latitude: number], dispatchId?: string): Promise<BloodRequestDispatch>;
}
