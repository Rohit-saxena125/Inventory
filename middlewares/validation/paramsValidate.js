const { z } = require('zod');
const mongoose = require('mongoose');
const { badRequestErrorResponse } = require('../../utils/customResponse');
exports.objectId = (key, type) =>
  z
    .string({ required_error: 'object Id is required' })
    .refine((value) => mongoose.Types.ObjectId.isValid(value), {
      message: `Invalid ${key} ${type}`,
    });

exports.validateParams = async (req, res, next) => {
  try {
    const schema = z.object({
      id: this.objectId('id', 'ObjectId'),
    });
    const value = await schema.required().parseAsync(req.params);
    req.params = value;
    next();
  } catch (error) {
    return badRequestErrorResponse(res, error.errors[0].message);
  }
};
