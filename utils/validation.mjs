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

export const handleError = (res, error, label) => {
    const details = formatValidationError(error);
    if (details) {
        return res.status(400).json({
            code: 400,
            message: "Validation failed",
            errors: details
        });
    }

    const duplicates = formatDuplicateError(error);
    if (duplicates) {
        return res.status(409).json({
            code: 409,
            message: "Conflict",
            errors: duplicates
        });
    }

    console.error(`[ERROR] ${label} ->`, error);
    res.status(500).json({
        code: 500,
        message: "Internal Server Error"
    });
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
