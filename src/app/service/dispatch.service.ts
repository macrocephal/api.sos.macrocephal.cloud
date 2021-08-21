import { Dispatch } from './../model/dispatch';
import { Service } from "./service";

export class DispatchService extends Service<Dispatch> {
    protected override unmarshall(hash: Record<string, string>): Dispatch {
        return {
            ...super.unmarshall(hash),
        };
    }

    key(idOrKeyOrModel: (string | `${string}:${string}`) | Partial<Dispatch>): `${string}:${string}` {
        return 'object' === typeof idOrKeyOrModel ? this.key(idOrKeyOrModel.id!)
            : this.isKey(idOrKeyOrModel) ? idOrKeyOrModel : `data:dispatch:${idOrKeyOrModel}`;
    }

    id(key: string): string {
        return key.split('data:dispatch:')[1]!;
    }
}
