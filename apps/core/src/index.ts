import { createCoreApp, defaultV1Dependencies } from './app';
import { supabaseRequestDependencyFactory } from './composition/supabase';

const app = createCoreApp({
  ...defaultV1Dependencies,
  requestFactory: supabaseRequestDependencyFactory,
});

export default app;
