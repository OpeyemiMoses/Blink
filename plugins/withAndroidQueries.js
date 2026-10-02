const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries || [];

    manifest.queries.push({
      intent: [
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
          data: [{ $: { 'android:scheme': 'solana-wallet' } }],
        },
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          data: [{ $: { 'android:scheme': 'phantom' } }],
        },
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          data: [{ $: { 'android:scheme': 'solflare' } }],
        },
      ],
      package: [
        { $: { 'android:name': 'app.phantom' } },
        { $: { 'android:name': 'com.solflare.mobile' } },
      ],
    });

    return config;
  });
};
