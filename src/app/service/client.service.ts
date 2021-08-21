import { Client } from './../model/client';
import { Service } from "./service";

export class ClientService extends Service<Client> {
    protected override unmarshall(hash: Record<string, string>): Client {
        return {
            ...super.unmarshall(hash),
        };
    }

    key(idOrKeyOrModel: (string | `${string}:${string}`) | Partial<Client>): `${string}:${string}` {
        return 'object' === typeof idOrKeyOrModel ? this.key(idOrKeyOrModel.id!)
            : this.isKey(idOrKeyOrModel) ? idOrKeyOrModel : `data:client:${idOrKeyOrModel}`;
    }

    id(key: string): string {
        return key.split('data:client:')[1]!;
    }
}
