import { Container } from './../../container';
import { BloodRequest } from './../model/blood-request';
import { BloodRequestDispatch } from './../model/blood-request-dispatch';
import { WithApplication } from './../with-application';

export class BloodRequestService extends WithApplication {
    #bloodRequestDispatches!: FirebaseFirestore.CollectionReference<BloodRequestDispatch>;
    #bloodRequests!: FirebaseFirestore.CollectionReference<BloodRequest>;

    constructor(container: Container) {
        super(container);
        (async () => {
            this.#bloodRequestDispatches = this.firebase.firestore().collection('dispatches:blood')
                .withConverter<BloodRequestDispatch>({
                    fromFirestore: snapshot => snapshot.data() as BloodRequestDispatch,
                    toFirestore: model => model,
                });
            this.#bloodRequests = this.firebase.firestore().collection('requests:blood')
                .withConverter<BloodRequest>({
                    fromFirestore: snapshot => snapshot.data() as BloodRequest,
                    toFirestore: model => model,
                });
        })();
    }
}
