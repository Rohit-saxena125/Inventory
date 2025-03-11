const { badRequestErrorResponse } = require('../../utils/customResponse');

exports.validate = async (schema, body, res, next) => {
  try {
    const value = await schema.parseAsync(body);
    return value;
  } catch (error) {
    return badRequestErrorResponse(res, error.errors[0].message);
  }
};
