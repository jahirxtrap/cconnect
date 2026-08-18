class ServerDefaults {
  revision = $state(0);

  bump() {
    this.revision += 1;
  }
}

export const serverDefaults = new ServerDefaults();
