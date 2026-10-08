import mongoose from "mongoose";

const Schema = new mongoose.Schema({
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    name: {
        type: String,
        required: [true, "name is required"],
        trim: true,
        minLength: [2, "name must be at least 2 characters"],
        maxLength: [100, "name must be at most 100 characters"]
    },
    amount: {
        type: Number,
        required: [true, "amount is required"],
        min: [0, "amount must be greater than or equal to 0"]
    },
    quantity: {
        type: Number,
        required: [true, "quantity is required"],
        min: [1, "quantity must be at least 1"],
        validate: [
            {
                validator: (value) => Number.isInteger(value),
                message: "quantity must be an integer"
            },
            {
                validator: function (value) {
                    return value >= (this.sold || 0);
                },
                message: "quantity cannot be lower than the number of tickets already sold"
            }
        ]
    },
    sold: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now }
}, {
    collection: "ticket_types",
    minimize: false,
    versionKey: false,
    id: false,
    toJSON: { virtuals: true }
});

Schema.virtual("remaining").get(function () {
    return this.quantity - this.sold;
});

Schema.index({ event: 1, created_at: 1 });

const TicketTypeModel = mongoose.model("TicketType", Schema);

export default TicketTypeModel;
