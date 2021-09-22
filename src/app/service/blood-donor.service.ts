import { BloodGroup } from '../model/blood-group';
import { RhesusFactor } from '../model/rhesus-factor';
import { Container } from './../../container';
import { BloodDonor } from './../model/blood-donor';
import { WithApplication } from './../with-application';

export class BloodDonorService extends WithApplication {
    #donors!: FirebaseFirestore.CollectionReference<BloodDonor>;

    constructor(container: Container) {
        super(container);
        (async () => {
            this.#donors = this.firebase.firestore().collection('donors:blood')
                .withConverter<BloodDonor>({
                    fromFirestore: snapshot => snapshot.data() as BloodDonor,
                    toFirestore: model => model,
                });
        })();
    }

    async create(userId: string, payload: { bloodGroup: BloodGroup, rhesusFactor?: RhesusFactor }): Promise<BloodDonor> {
        this.logger.debug('BloodDonorService.create <<< ', ...arguments);
        const donor: BloodDonor = { ...payload, createdAt: Date.now(), id: userId };
        let pipeline = this.redis.pipeline().sadd(this.key.donors.blood.group(donor.bloodGroup), userId);
        if (donor.rhesusFactor) pipeline = pipeline.sadd(this.key.donors.blood.rhesus(donor.rhesusFactor), userId);

        await Promise.all([
            this.#donors.doc(donor.id).set(donor, { merge: false }),
            pipeline.exec(),
        ]);

        this.logger.debug('BloodDonorService.create >>> ', donor);
        return donor;
    }
}
