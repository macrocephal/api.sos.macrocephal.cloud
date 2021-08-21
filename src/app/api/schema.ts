import Joi, { SchemaMap } from 'joi';


export const id: SchemaMap = {
    id: Joi.string().uuid(),
};

export const ID: SchemaMap = {
    id: (id.id as Joi.StringSchema).required(),
};

export const CREATED: SchemaMap = {
    ...ID,
    createdAt: Joi.date().timestamp().required(),
};

export const UPDATED: SchemaMap = {
    ...CREATED,
    updatedAt: Joi.date().timestamp().required(),
};

export const VALIDATION_ERRORS = Joi.array().items(
    Joi.object({
        type: Joi.string().required(),
        message: Joi.string().required(),
        context: Joi.object().unknown().label('ErrorContext'),
        path: Joi.array().items(Joi.string(), Joi.number()).required().label('ErrorPath'),
    }).label('ValidationError'),
).required().label('ValidationErrors');
