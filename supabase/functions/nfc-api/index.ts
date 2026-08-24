import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

import { createClient } from "jsr:@supabase/supabase-js@2";

function getSupabase(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey);
  return { client, admin };
}

async function getProfile(client: any) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
}

function generateFarmerId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `KB-F-${num}`;
}

function generateHarvestId(cropName: string) {
  const cropCode = (cropName || "CROP").toUpperCase().replace(/[^A-Z]/g, "").substring(0, 3) || "CRO";
  const year = new Date().getFullYear();
  const num = Math.floor(1 + Math.random() * 999);
  return `KB-${cropCode}-${year}-${String(num).padStart(3, "0")}`;
}

function generateMachineryId() {
  const num = Math.floor(1 + Math.random() * 999);
  return `KB-MACH-${String(num).padStart(3, "0")}`;
}

async function getFarmerEntity(admin: any, tag: any) {
  const { data: farmer } = await admin.from("profiles")
    .select("full_name, village, district, state, role, is_active, created_at, phone, email, avatar_url")
    .eq("id", tag.entity_id).maybeSingle();

  if (!farmer) return null;

  const { data: farm } = await admin.from("farms")
    .select("id, size_acres, name, soil_type, irrigation_source, location, latitude, longitude")
    .eq("user_id", tag.entity_id).maybeSingle();

  // Cluster
  let clusterName: string | null = null;
  let clusterCrop: string | null = null;
  const { data: clusterMember } = await admin.from("cluster_members")
    .select("cluster_id").eq("user_id", tag.entity_id).maybeSingle();
  if (clusterMember?.cluster_id) {
    const { data: cluster } = await admin.from("farm_clusters")
      .select("name, crop_name").eq("id", clusterMember.cluster_id).maybeSingle();
    clusterName = cluster?.name || null;
    clusterCrop = cluster?.crop_name || null;
  }

  // All farm crops
  let farmCrops: { crop_name: string; status: string; area_acres: number; expected_yield_kg: number }[] = [];
  if (farm?.id) {
    const { data: crops } = await admin.from("farm_crops")
      .select("crop_name, status, area_acres, expected_yield_kg")
      .eq("farm_id", farm.id)
      .order("created_at", { ascending: false });
    farmCrops = (crops || []).map((c: any) => ({
      crop_name: c.crop_name || "",
      status: c.status || "",
      area_acres: Number(c.area_acres) || 0,
      expected_yield_kg: Number(c.expected_yield_kg) || 0,
    }));
  }

  // Harvest lots created by this farmer
  const { data: lots } = await admin.from("harvest_lots")
    .select("id, crop_name, total_quantity_kg, quality_grade, harvest_date, status, price_per_kg, location")
    .eq("created_by", tag.entity_id)
    .order("created_at", { ascending: false })
    .limit(10);
  const harvestLots = (lots || []).map((l: any) => ({
    crop_name: l.crop_name || "",
    quantity_kg: Number(l.total_quantity_kg) || 0,
    quality_grade: l.quality_grade || "Pending",
    harvest_date: l.harvest_date || null,
    status: l.status || "",
    price_per_kg: Number(l.price_per_kg) || 0,
    location: l.location || "",
  }));

  // Machinery owned by this farmer
  const { data: machines } = await admin.from("machinery")
    .select("name, type, price_per_hour, is_available, location")
    .eq("owner_id", tag.entity_id)
    .order("created_at", { ascending: false });
  const machinery = (machines || []).map((m: any) => ({
    name: m.name || "",
    type: m.type || "",
    price_per_hour: Number(m.price_per_hour) || 0,
    available: m.is_available || false,
    location: m.location || "",
  }));

  // Harvest contributions by this farmer
  const { data: contribs } = await admin.from("harvest_contributions")
    .select("quantity_kg, lot_id").eq("user_id", tag.entity_id);
  const totalContributionKg = (contribs || []).reduce((sum: number, c: any) => sum + Number(c.quantity_kg), 0);

  return {
    type: "FARMER" as const,
    farmerId: tag.tag_uid,
    name: farmer.full_name,
    village: farmer.village || "",
    district: farmer.district || "",
    state: farmer.state || "",
    phone: farmer.phone || "",
    email: farmer.email || "",
    avatarUrl: farmer.avatar_url || "",
    isActive: farmer.is_active,
    memberSince: farmer.created_at,
    farmSize: farm?.size_acres || null,
    farmName: farm?.name || null,
    soilType: farm?.soil_type || null,
    irrigationSource: farm?.irrigation_source || null,
    farmLocation: farm?.location || null,
    cluster: clusterName,
    clusterCrop,
    farmCrops,
    harvestLots,
    machinery,
    totalContributionKg,
    cropStatus: farmCrops[0]?.status || null,
    currentCrop: farmCrops[0]?.crop_name || null,
  };
}

async function getHarvestEntity(admin: any, tag: any, profile: any, locationData: any) {
  const { data: lot } = await admin.from("harvest_lots")
    .select("*").eq("id", tag.entity_id).maybeSingle();

  if (!lot) return null;

  // Fetch contributions separately (no FK to profiles, so join manually)
  const { data: contributions } = await admin.from("harvest_contributions")
    .select("quantity_kg, user_id").eq("lot_id", lot.id);

  // Resolve farmer names manually
  let mappedContributions: { farmerName: string; quantityKg: number }[] = [];
  if (contributions && contributions.length > 0) {
    const userIds = [...new Set(contributions.map((c: any) => c.user_id))];
    const { data: profs } = await admin.from("profiles")
      .select("id, full_name").in("id", userIds);
    const profMap = new Map((profs || []).map((p: any) => [p.id, p.full_name || "Unknown"]));
    mappedContributions = contributions.map((c: any) => ({
      farmerName: profMap.get(c.user_id) || "Unknown",
      quantityKg: Number(c.quantity_kg),
    }));
  }

  // Fetch cluster name
  let clusterName: string | null = null;
  if (lot.cluster_id) {
    const { data: cluster } = await admin.from("farm_clusters")
      .select("name").eq("id", lot.cluster_id).maybeSingle();
    clusterName = cluster?.name || null;
  }

  // Fetch quality assessment
  const { data: quality } = await admin.from("quality_assessments")
    .select("grade, score").eq("lot_id", lot.id).maybeSingle();

  const contributorCount = contributions?.length || 0;

  const isBuyer = profile.role === "buyer" || profile.active_role === "buyer";
  const isOwner = lot.created_by === profile.id;
  const isAdmin = profile.role === "admin";

  // Add traceability event: BUYER_VIEWED
  if (isBuyer) {
    await admin.from("nfc_traceability_events").insert({
      lot_id: lot.id,
      tag_id: tag.id,
      event_type: "BUYER_VIEWED",
      actor_id: profile.id,
      latitude: locationData?.latitude || null,
      longitude: locationData?.longitude || null,
      location: locationData?.location || null,
    });
  }

  return {
    type: "HARVEST" as const,
    lotId: tag.tag_uid,
    crop: lot.crop_name,
    quantity: Number(lot.total_quantity_kg),
    harvestDate: lot.harvest_date,
    location: lot.location || "",
    cluster: clusterName,
    qualityGrade: quality?.grade || lot.quality_grade || "Pending",
    qualityScore: quality?.score || null,
    status: lot.status,
    pricePerKg: Number(lot.price_per_kg),
    contributorCount,
    contributions: (!isBuyer || isOwner || isAdmin) ? mappedContributions : undefined,
  };
}

async function getMachineryEntity(admin: any, tag: any) {
  const { data: mach } = await admin.from("machinery")
    .select("name, type, price_per_hour, is_available, location")
    .eq("id", tag.entity_id).maybeSingle();

  if (!mach) return null;

  return {
    type: "MACHINERY" as const,
    machineryId: tag.tag_uid,
    name: mach.name,
    machineType: mach.type,
    pricePerHour: Number(mach.price_per_hour),
    available: mach.is_available,
    location: mach.location || "",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/functions\/v1\/nfc-api/, "");
    const { client, admin } = getSupabase(req);
    const profile = await getProfile(client);

    if (!profile) {
      return jsonResponse(401, { error: "Authentication required" });
    }

    // POST /register — register a new NFC tag
    if (path === "/register" && req.method === "POST") {
      const { tagUid, entityType, entityId } = await req.json();

      if (!tagUid || !entityType) {
        return jsonResponse(400, { error: "tagUid and entityType are required" });
      }

      const validTypes = ["FARMER", "HARVEST", "MACHINERY"];
      if (!validTypes.includes(entityType)) {
        return jsonResponse(400, { error: "Invalid entityType" });
      }

      const { data: existing } = await admin.from("nfc_tags").select("id").eq("tag_uid", tagUid).maybeSingle();
      if (existing) {
        return jsonResponse(409, { error: "Tag UID already registered" });
      }

      if (entityId) {
        const table = entityType === "FARMER" ? "profiles" : entityType === "HARVEST" ? "harvest_lots" : "machinery";
        const { data: entity } = await admin.from(table).select("id").eq("id", entityId).maybeSingle();
        if (!entity) {
          return jsonResponse(404, { error: `${entityType} entity not found` });
        }
      }

      const { data, error } = await admin.from("nfc_tags").insert({
        tag_uid: tagUid,
        entity_type: entityType,
        entity_id: entityId || null,
        qr_token: tagUid,
        registered_by: profile.id,
      }).select().single();

      if (error) {
        return jsonResponse(500, { error: "Failed to register tag" });
      }

      await admin.from("nfc_scan_logs").insert({
        tag_id: data.id,
        tag_uid: tagUid,
        scanned_by: profile.id,
        scan_result: "SUCCESS",
      });

      return jsonResponse(200, { tag: data });
    }

    // POST /scan — scan an NFC tag and retrieve associated entity
    if (path === "/scan" && req.method === "POST") {
      const { tagUid, latitude, longitude, location } = await req.json();

      if (!tagUid) {
        return jsonResponse(400, { error: "tagUid is required" });
      }

      const { data: tag } = await admin.from("nfc_tags").select("*").eq("tag_uid", tagUid).maybeSingle();

      if (!tag) {
        await admin.from("nfc_scan_logs").insert({
          tag_uid: tagUid,
          scanned_by: profile.id,
          scan_result: "NOT_FOUND",
          latitude, longitude, location,
        });
        return jsonResponse(404, { error: "Tag not recognized", result: "NOT_FOUND" });
      }

      if (tag.status === "BLOCKED") {
        await admin.from("nfc_scan_logs").insert({
          tag_id: tag.id,
          tag_uid: tagUid,
          scanned_by: profile.id,
          scan_result: "BLOCKED",
          latitude, longitude, location,
        });
        return jsonResponse(403, { error: "This tag has been blocked", result: "BLOCKED" });
      }

      if (tag.status === "LOST") {
        await admin.from("nfc_scan_logs").insert({
          tag_id: tag.id,
          tag_uid: tagUid,
          scanned_by: profile.id,
          scan_result: "BLOCKED",
          latitude, longitude, location,
        });
        return jsonResponse(403, { error: "This tag has been reported lost", result: "BLOCKED" });
      }

      await admin.from("nfc_tags").update({
        last_scanned_at: new Date().toISOString(),
        last_scanned_by: profile.id,
      }).eq("id", tag.id);

      await admin.from("nfc_scan_logs").insert({
        tag_id: tag.id,
        tag_uid: tagUid,
        scanned_by: profile.id,
        scan_result: "SUCCESS",
        latitude, longitude, location,
      });

      const locationData = { latitude, longitude, location };
      let entityData: any = null;

      if (tag.entity_type === "FARMER" && tag.entity_id) {
        entityData = await getFarmerEntity(admin, tag);
      } else if (tag.entity_type === "HARVEST" && tag.entity_id) {
        entityData = await getHarvestEntity(admin, tag, profile, locationData);
      } else if (tag.entity_type === "MACHINERY" && tag.entity_id) {
        entityData = await getMachineryEntity(admin, tag);
      }

      if (!entityData) {
        return jsonResponse(404, { error: "Associated entity not found", result: "NOT_FOUND" });
      }

      return jsonResponse(200, { tag, entity: entityData });
    }

    // GET /:tagUid — lookup tag info (admin only)
    if (path && path.startsWith("/") && path.length > 1 && req.method === "GET") {
      const tagUid = path.substring(1);
      const { data: tag } = await admin.from("nfc_tags").select("*").eq("tag_uid", tagUid).maybeSingle();

      if (!tag) {
        return jsonResponse(404, { error: "Tag not found" });
      }

      return jsonResponse(200, { tag });
    }

    // POST /assign — assign a tag to an entity
    if (path === "/assign" && req.method === "POST") {
      const { tagUid, entityType, entityId } = await req.json();

      if (!tagUid || !entityType || !entityId) {
        return jsonResponse(400, { error: "tagUid, entityType, and entityId are required" });
      }

      const { data: tag } = await admin.from("nfc_tags").select("*").eq("tag_uid", tagUid).maybeSingle();
      if (!tag) {
        return jsonResponse(404, { error: "Tag not found" });
      }

      if (tag.status === "BLOCKED") {
        return jsonResponse(403, { error: "Cannot assign a blocked tag" });
      }

      if (tag.entity_id && tag.entity_id !== entityId) {
        return jsonResponse(409, { error: "Tag is already assigned to another entity" });
      }

      const { data, error } = await admin.from("nfc_tags").update({
        entity_type: entityType,
        entity_id: entityId,
        updated_at: new Date().toISOString(),
      }).eq("id", tag.id).select().single();

      if (error) {
        return jsonResponse(500, { error: "Failed to assign tag" });
      }

      if (entityType === "HARVEST") {
        await admin.from("nfc_traceability_events").insert({
          lot_id: entityId,
          tag_id: tag.id,
          event_type: "NFC_ASSIGNED",
          actor_id: profile.id,
        });
      }

      return jsonResponse(200, { tag: data });
    }

    // POST /unassign — unassign a tag from its entity
    if (path === "/unassign" && req.method === "POST") {
      const { tagUid } = await req.json();

      if (!tagUid) {
        return jsonResponse(400, { error: "tagUid is required" });
      }

      const { data: tag } = await admin.from("nfc_tags").select("*").eq("tag_uid", tagUid).maybeSingle();
      if (!tag) {
        return jsonResponse(404, { error: "Tag not found" });
      }

      if (profile.role !== "admin" && tag.registered_by !== profile.id) {
        return jsonResponse(403, { error: "Not authorized to unassign this tag" });
      }

      const { data, error } = await admin.from("nfc_tags").update({
        entity_id: null,
        updated_at: new Date().toISOString(),
      }).eq("id", tag.id).select().single();

      if (error) {
        return jsonResponse(500, { error: "Failed to unassign tag" });
      }

      return jsonResponse(200, { tag: data });
    }

    // POST /generate-id — generate a unique ID for a new tag
    if (path === "/generate-id" && req.method === "POST") {
      const { entityType, cropName } = await req.json();

      let tagUid = "";
      if (entityType === "FARMER") {
        tagUid = generateFarmerId();
      } else if (entityType === "HARVEST") {
        tagUid = generateHarvestId(cropName || "");
      } else if (entityType === "MACHINERY") {
        tagUid = generateMachineryId();
      } else {
        return jsonResponse(400, { error: "Invalid entityType" });
      }

      let attempts = 0;
      while (attempts < 5) {
        const { data: existing } = await admin.from("nfc_tags").select("id").eq("tag_uid", tagUid).maybeSingle();
        if (!existing) break;
        if (entityType === "FARMER") tagUid = generateFarmerId();
        else if (entityType === "HARVEST") tagUid = generateHarvestId(cropName || "");
        else tagUid = generateMachineryId();
        attempts++;
      }

      return jsonResponse(200, { tagUid });
    }

    // POST /status — update tag status (admin only)
    if (path === "/status" && req.method === "POST") {
      if (profile.role !== "admin") {
        return jsonResponse(403, { error: "Admin access required" });
      }

      const { tagUid, status } = await req.json();
      const validStatuses = ["ACTIVE", "INACTIVE", "LOST", "BLOCKED"];
      if (!tagUid || !validStatuses.includes(status)) {
        return jsonResponse(400, { error: "Invalid status" });
      }

      const { data, error } = await admin.from("nfc_tags").update({
        status,
        updated_at: new Date().toISOString(),
      }).eq("tag_uid", tagUid).select().single();

      if (error) {
        return jsonResponse(500, { error: "Failed to update tag status" });
      }

      return jsonResponse(200, { tag: data });
    }

    // GET /traceability/:lotId — get traceability timeline for a lot
    const traceMatch = path.match(/^\/traceability\/(.+)$/);
    if (traceMatch && req.method === "GET") {
      const lotId = traceMatch[1];
      const { data: events } = await admin.from("nfc_traceability_events")
        .select("*").eq("lot_id", lotId)
        .order("created_at", { ascending: true });

      // Resolve actor names manually (no FK-based join)
      const actorIds = [...new Set((events || []).map((e: any) => e.actor_id).filter(Boolean))];
      let actorMap = new Map<string, { full_name: string; role: string }>();
      if (actorIds.length > 0) {
        const { data: profs } = await admin.from("profiles")
          .select("id, full_name, role").in("id", actorIds);
        actorMap = new Map((profs || []).map((p: any) => [p.id, { full_name: p.full_name || "Unknown", role: p.role || "" }]));
      }

      const enrichedEvents = (events || []).map((e: any) => ({
        ...e,
        profiles: e.actor_id ? actorMap.get(e.actor_id) || null : null,
      }));

      return jsonResponse(200, { events: enrichedEvents });
    }

    // GET /tags — list all tags (admin only)
    if (path === "/tags" && req.method === "GET") {
      if (profile.role !== "admin") {
        return jsonResponse(403, { error: "Admin access required" });
      }

      const { data: tags } = await admin.from("nfc_tags")
        .select("*").order("created_at", { ascending: false });

      return jsonResponse(200, { tags: tags || [] });
    }

    return jsonResponse(404, { error: "Endpoint not found" });
  } catch (error) {
    console.error("NFC API error:", error.message);
    return jsonResponse(500, { error: "Something went wrong" });
  }
});

function jsonResponse(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
