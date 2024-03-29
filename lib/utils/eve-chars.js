import { inherits } from 'util';

export default class {
  constructor(api) {
    this.hapServ = api.hap.Service;
    this.hapChar = api.hap.Characteristic;
    this.uuids = {
      lastActivation: 'E863F11A-079E-48FF-8F27-9C2605A29F52',
    };
    const self = this;
    this.LastActivation = function LastActivation() {
      self.hapChar.call(this, 'Last Activation', self.uuids.lastActivation);
      this.setProps({
        format: self.hapChar.Formats.UINT32,
        unit: self.hapChar.Units.SECONDS,
        perms: [self.hapChar.Perms.READ, self.hapChar.Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
    };
    inherits(this.LastActivation, this.hapChar);
    this.LastActivation.UUID = this.uuids.lastActivation;
  }
}
