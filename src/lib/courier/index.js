import { sendToSteadfast, trackSteadfastOrder } from "@/lib/courier/steadfast";

export async function sendCourierOrder({ courierType, config, delivery }) {
  if (courierType === "steadfast") {
    return sendToSteadfast({ config, delivery });
  }
  }

  throw new Error(`Unsupported courier '${courierType}'`);
}

export async function trackCourierOrder({ courierType, config, delivery }) {
  if (courierType === "steadfast") {
    return trackSteadfastOrder({ config, delivery });
  }

  throw new Error(`Unsupported courier '${courierType}'`);
}
