module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo"],
      "nativewind/babel",
    ],
    plugins: [
      // Transform import.meta.env → process.env for web compat
      // (zustand v5 uses import.meta.env which fails in Metro's non-module output)
      function importMetaEnvPlugin({ types: t }) {
        return {
          visitor: {
            MetaProperty(path) {
              path.replaceWith(
                t.objectExpression([
                  t.objectProperty(
                    t.identifier("env"),
                    t.memberExpression(
                      t.identifier("process"),
                      t.identifier("env")
                    )
                  ),
                ])
              );
            },
          },
        };
      },
    ],
  };
};
