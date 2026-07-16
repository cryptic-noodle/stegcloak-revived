import { hide, reveal, ZWC } from "@stegcloak/core";

export default class StegCloak {
  constructor(_encrypt = true, _integrity = false) {
    this.encrypt = _encrypt;
    this.integrity = _integrity; // Maintained for constructor backward compatibility
  }

  static get zwc() {
    return ZWC;
  }

  async hide(message, password, cover = "This is a confidential text") {
    if (this.encrypt && !password) {
      throw new Error("Password is required for encryption");
    }
    const pwd = this.encrypt ? password : undefined;
    return hide({
      secret: message,
      cover,
      password: pwd
    });
  }

  async reveal(secret, password) {
    return reveal({
      text: secret,
      password
    });
  }
}
