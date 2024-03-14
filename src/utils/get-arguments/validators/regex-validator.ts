import {logger} from "@/utils";

export const regexValidator = (value: string) => {
    try {
        new RegExp(value);
    } catch (e) {
      logger.error('Invalid regex')
      process.exit()
    }
    return value;
}
