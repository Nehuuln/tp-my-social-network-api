export const formatValidationError = (error) => {
    if (error.name === "ValidationError") {
        return Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.name === "CastError" ? `${err.path} is invalid` : err.message
        }));
    }

    if (error.name === "CastError") {
        return [{
            field: error.path === "_id" ? "id" : error.path,
            message: `${error.path === "_id" ? "id" : error.path} is invalid`
        }];
    }

    return null;
};

export const formatDuplicateError = (error) => {
    if (error.code !== 11000) {
        return null;
    }

    return Object.keys(error.keyPattern || {}).map((field) => ({
        field,
        message: `${field} is already used`
    }));
};
