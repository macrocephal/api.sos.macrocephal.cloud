import Joi, { DateSchema, SchemaMap } from 'joi';


export const id: SchemaMap = {
    id: Joi.string().guid({ version: 'uuidv4' }),
};

export const ID: SchemaMap = {
    id: (id.id as Joi.StringSchema).required(),
};

export const CREATED: SchemaMap = {
    ...ID,
    createdAt: Joi.date().timestamp().required(),
};

export const updated: SchemaMap = {
    ...CREATED,
    updatedAt: Joi.date().timestamp(),
};

export const UPDATED: SchemaMap = {
    ...updated,
    updatedAt: (updated.updatedAt as DateSchema).required(),
};

export const recycled: SchemaMap = {
    ...updated,
    recycledAt: Joi.date().timestamp(),
};

export const RECYCLED: SchemaMap = {
    ...recycled,
    recycledAt: (recycled.recycledAt as DateSchema).required(),
};

export const VALIDATION_ERRORS = Joi.array().items(
    Joi.object({
        type: Joi.string().required(),
        message: Joi.string().required(),
        context: Joi.object({
            value: Joi.any(),
            key: Joi.string(),
            label: Joi.string(),
        }).unknown().label('ErrorContext'),
        path: Joi.array().items(Joi.string(), Joi.number()).required().label('ErrorPath'),
    }).label('ValidationError'),
).required().label('ValidationErrors');
