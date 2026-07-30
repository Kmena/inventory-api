(function attachRootShellRegistry(globalScope) {
  const registry = new Map();

  function validateDependencyName(name) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('RootShell registry requiere un nombre de dependencia no vacio.');
    }

    return name.trim();
  }

  function register(name, value) {
    const normalizedName = validateDependencyName(name);
    if (registry.has(normalizedName)) {
      throw new Error(`La dependencia RootShell "${normalizedName}" ya fue registrada.`);
    }

    registry.set(normalizedName, value);
    return value;
  }

  function requireDependency(name) {
    const normalizedName = validateDependencyName(name);
    if (!registry.has(normalizedName)) {
      throw new Error(`Falta la dependencia requerida de RootShell: ${normalizedName}`);
    }

    return registry.get(normalizedName);
  }

  function has(name) {
    return registry.has(validateDependencyName(name));
  }

  /** @type {any} */ (globalScope).RootShell = {
    register,
    require: requireDependency,
    has,
  };
}(window));
