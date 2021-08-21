import { User } from './../model/user';

import { Service } from "./service";

export class UserService extends Service<User> {
    protected override unmarshall(hash: Record<string, string>): User {
        return {
            ...super.unmarshall(hash),
        };
    }

    key(idOrKeyOrModel: (string | `${string}:${string}`) | Partial<User>): `${string}:${string}` {
        return 'object' === typeof idOrKeyOrModel ? this.key(idOrKeyOrModel.id!)
            : this.isKey(idOrKeyOrModel) ? idOrKeyOrModel : `data:user:${idOrKeyOrModel}`;
    }

    id(key: string): string {
        return key.split('data:user:')[1]!;
    }
}
