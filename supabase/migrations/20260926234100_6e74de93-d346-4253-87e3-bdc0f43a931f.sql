CREATE OR REPLACE FUNCTION public.seed_demo_tenant(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid; u uuid := auth.uid(); c1 uuid; c2 uuid; o uuid; p1 uuid; p2 uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  t := public.create_tenant(_name, 'real_estate', true);
  INSERT INTO organizations(tenant_id,name,industry,created_by,owner_id) VALUES (t,_name||' Partners LLC','Investment',u,u) RETURNING id INTO o;
  INSERT INTO contacts(tenant_id,organization_id,full_name,email,phone,preferred_channel,marketing_consent,created_by,owner_id)
    VALUES (t,o,'Priya Sample','priya@example.test','+1 555 0101','email',true,u,u) RETURNING id INTO c1;
  INSERT INTO contacts(tenant_id,full_name,email,preferred_channel,marketing_consent,created_by,owner_id)
    VALUES (t,'Daniel Demo','daniel@example.test','phone',false,u,u) RETURNING id INTO c2;
  INSERT INTO leads(tenant_id,full_name,email,phone,source,status,score,tags,next_action,created_by,owner_id,provenance) VALUES
    (t,'Alex Example','alex@example.test','+1 555 0110','website','new',72,ARRAY['demo','3bhk'],'Call back',u,u,'{"seed":true}'),
    (t,'Morgan Test','morgan@example.test',NULL,'referral','nurturing',45,ARRAY['demo'],'Send brochure',u,u,'{"seed":true}'),
    (t,'Sam Synthetic',NULL,'+1 555 0112','walk_in','accepted',88,ARRAY['demo','hot'],'Book site visit',u,u,'{"seed":true}');
  INSERT INTO properties(tenant_id,title,project,location,property_type,area_sqft,bedrooms,price,currency,status,amenities,created_by) VALUES
    (t,'Lakeview 3BHK','Lakeview','North District','apartment',1450,3,420000,'USD','available',ARRAY['pool','gym'],u) RETURNING id INTO p1;
  INSERT INTO properties(tenant_id,title,location,property_type,area_sqft,bedrooms,price,currency,status,amenities,created_by) VALUES
    (t,'Garden Villa','South Hills','villa',2800,4,910000,'USD','available',ARRAY['garden'],u) RETURNING id INTO p2;
  INSERT INTO opportunities(tenant_id,name,contact_id,organization_id,stage,state,value,currency,created_by,owner_id) VALUES
    (t,'Priya – Lakeview 3BHK',c1,o,'qualification','open',420000,'USD',u,u),
    (t,'Daniel – Garden Villa',c2,NULL,'qualification','open',910000,'USD',u,u);
  INSERT INTO tasks(tenant_id,title,kind,due_at,status,contact_id,assignee_id,created_by) VALUES
    (t,'Follow up with Priya','call',now()+interval '1 day','open',c1,u,u),
    (t,'Send villa floor plan','email',now()-interval '1 day','open',c2,u,u);
  INSERT INTO activities(tenant_id,contact_id,kind,summary,occurred_at,created_by) VALUES
    (t,c1,'note','Synthetic demo record',now(),u);
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.seed_demo_tenant(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_tenant(text) TO authenticated;