-- Stable, data-free manifest for the production public/private schema baseline.
-- The same query is run against production and the disposable local Supabase database.
SELECT 'relation', n.nspname||'.'||c.relname, c.relkind::text,
       pg_catalog.pg_get_userbyid(c.relowner), c.relrowsecurity::text, c.relforcerowsecurity::text
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','v','m','S','f')
UNION ALL
SELECT 'column', n.nspname||'.'||c.relname, a.attnum::text, a.attname,
       pg_catalog.format_type(a.atttypid,a.atttypmod),
       concat_ws(':','notnull='||a.attnotnull::text,
         'default='||coalesce(pg_catalog.pg_get_expr(d.adbin,d.adrelid),''),
         'identity='||a.attidentity::text,'generated='||a.attgenerated::text,
         'collation='||coalesce(coll.collname,''))
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
LEFT JOIN pg_catalog.pg_collation coll ON coll.oid=a.attcollation
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','v','m','f')
  AND a.attnum>0 AND NOT a.attisdropped
UNION ALL
SELECT 'constraint', n.nspname||'.'||c.relname, con.conname, con.contype::text,
       md5(pg_catalog.pg_get_constraintdef(con.oid,true)), con.convalidated::text
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid=con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'index', n.nspname||'.'||tbl.relname, idx.relname,
       i.indisunique::text||':'||i.indisprimary::text,
       md5(pg_catalog.pg_get_indexdef(i.indexrelid)), ''
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class tbl ON tbl.oid=i.indrelid
JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
JOIN pg_catalog.pg_namespace n ON n.oid=tbl.relnamespace
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'function', n.nspname||'.'||p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid), p.prokind::text,
       pg_catalog.pg_get_userbyid(p.proowner), md5(pg_catalog.pg_get_functiondef(p.oid))
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'trigger', n.nspname||'.'||c.relname, t.tgname, t.tgenabled::text,
       md5(pg_catalog.pg_get_triggerdef(t.oid,true)), ''
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private') AND NOT t.tgisinternal
UNION ALL
SELECT 'policy', p.schemaname||'.'||p.tablename, p.policyname, p.cmd,
       p.permissive, md5(coalesce(p.qual,'')||E'\n'||coalesce(p.with_check,''))||':'||array_to_string(p.roles,',')
FROM pg_catalog.pg_policies p
WHERE p.schemaname IN ('public','private','storage')
UNION ALL
SELECT 'enum', n.nspname||'.'||t.typname, e.enumsortorder::text, e.enumlabel, '', ''
FROM pg_catalog.pg_type t
JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'view', n.nspname||'.'||c.relname, c.relkind::text, '',
       md5(pg_catalog.pg_get_viewdef(c.oid,true)), ''
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private') AND c.relkind IN ('v','m')
UNION ALL
SELECT 'relation_acl', n.nspname||'.'||c.relname,
       coalesce(r.rolname,'PUBLIC'), a.privilege_type, a.is_grantable::text, ''
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(c.relacl,pg_catalog.acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))
) a
LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','v','m','S','f')
UNION ALL
SELECT 'function_acl', n.nspname||'.'||p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid)||':'||coalesce(r.rolname,'PUBLIC'),
       a.privilege_type, a.is_grantable::text, ''
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(p.proacl,pg_catalog.acldefault('f'::"char",p.proowner))
) a
LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'schema_acl', n.nspname, coalesce(r.rolname,'PUBLIC'),
       a.privilege_type, a.is_grantable::text, ''
FROM pg_catalog.pg_namespace n
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(n.nspacl,pg_catalog.acldefault('n'::"char",n.nspowner))
) a
LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee
WHERE n.nspname IN ('public','private')
UNION ALL
SELECT 'default_acl', coalesce(n.nspname,'<global>')||':'||d.defaclobjtype,
       pg_catalog.pg_get_userbyid(d.defaclrole)||':'||coalesce(r.rolname,'PUBLIC'),
       a.privilege_type, a.is_grantable::text, ''
FROM pg_catalog.pg_default_acl d
LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee
WHERE d.defaclnamespace=0 OR n.nspname IN ('public','private')
UNION ALL
SELECT 'sequence', n.nspname||'.'||c.relname, s.seqstart::text,
       s.seqincrement::text, s.seqmin::text||':'||s.seqmax::text,
       s.seqcache::text||':'||s.seqcycle::text
FROM pg_catalog.pg_sequence s
JOIN pg_catalog.pg_class c ON c.oid=s.seqrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private')
ORDER BY 1,2,3,4,5,6;
