// Aufrufe an den Hauptprozess: rpc.listProducts() → window.pw.call('listProducts')
export const rpc = new Proxy({}, {
  get: (target, method) => (...args) => window.pw.call(method, ...args),
});
export const onChanged = (fn) => window.pw.onChanged(fn);
