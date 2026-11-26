-- SPDX-License-Identifier: Apache-2.0
--
-- What an installed application may do with sound: play, and record only
-- when the person allowed it the microphone.
--
-- Installed as /usr/share/wireplumber/scripts/luma/application-sound.lua by
-- luma-application-installer and loaded by 70-luma-application-access.conf.
--
-- An application reaches PipeWire in one of three ways, and each is told
-- apart by what the server records, never by what the application says:
--
-- * its own PulseAudio server (luma-application-sound@.service), which
--   connects on pipewire-0-application-pulse and gives each of its clients
--   the access "luma-application" and the application's ID
--   (pipewire.access.portal.app_id), set by the server's own rules after
--   anything the application sent;
-- * the native socket for applications, pipewire-0-application
--   (60-luma-application-socket.conf): play only, no ID;
-- * a Flatpak on the session's sockets, which PipeWire and pipewire-pulse
--   mark with the access "flatpak" and its Flatpak ID.
--
-- The permission is the portal's own: the permission store's devices /
-- microphone row, ["yes"] for the application's ID. A change applies at
-- once: a grant makes the microphones visible and the next recording links;
-- a withdrawal hides them and ends any recording the application has open.
--
-- A refused recording is told so (an access error on its stream, which
-- pipewire-pulse passes on as "Access denied") and is never left waiting.
-- The refusal is also written to the "luma-application-refusals" metadata
-- (key: the application's ID) for the desktop to offer the grant.
--
-- WirePlumber 0.5.18 (the desktop's) applies the view with a permission
-- manager chosen in the select-access event; 0.5.14 (phones) has none, and
-- the permissions are set on each client as its own access-portal.lua does.

lutils = require ("linking-utils")
log = Log.open_topic ("s-luma-application")

NATIVE_SOCKET = "pipewire-0-application"
PULSE_SOCKET = "pipewire-0-application-pulse"
ACCESS = "luma-application"
SOURCES = {
  ["Audio/Source"] = true,
  ["Audio/Source/Virtual"] = true,
  ["Audio/Duplex"] = true,
}

-- The application a client belongs to: (kind, app ID or nil), or nil for
-- a client that is not an installed application.
function identity (properties)
  local socket = properties ["pipewire.sec.socket"]
  local access = properties ["pipewire.access"]
  if socket == NATIVE_SOCKET then
    -- Anything on this socket may have named itself; it has no ID.
    return "native", nil
  end
  if socket == PULSE_SOCKET and access == ACCESS then
    local app = properties ["pipewire.access.portal.app_id"]
    return "pulse", (app ~= nil and app ~= "") and app or nil
  end
  if (access == "flatpak" or properties ["pipewire.sec.flatpak"] == "true")
      and properties ["media.category"] ~= "Manager" then
    -- A Flatpak with every device can open the sound card itself.
    local app = properties ["pipewire.access.portal.app_id"]
    return "flatpak", (app ~= nil and app ~= "") and app or nil
  end
  return nil
end

-- devices / microphone, kept current from the store's Changed signal.
pps = Plugin.find ("portal-permissionstore")
microphone = {}
microphone_loaded = false

function grants ()
  if not microphone_loaded and pps ~= nil then
    local found = pps:call ("lookup", "devices", "microphone")
    if found ~= nil then
      microphone = found
      microphone_loaded = true
    end
  end
  return microphone
end

function allowed (app)
  if app == nil then
    return false
  end
  for _, value in pairs (grants () [app] or {}) do
    if value == "yes" then
      return true
    end
  end
  return false
end

clients_om = ObjectManager { Interest { type = "client" } }
streams_om = ObjectManager {
  Interest { type = "node", Constraint { "media.class", "=", "Stream/Input/Audio" } },
}

-- An application client of its own server or of the application socket
-- (a Flatpak's view is WirePlumber's own; only its recordings are held to
-- the permission, below).
function viewed (client)
  local kind, app = identity (client.properties)
  return kind ~= nil and kind ~= "flatpak", kind, app
end

-- Its own streams, their ports and the links WirePlumber made for them:
-- pipewire-pulse names a stream and its sink by them and answers nothing
-- until it sees them.
nodes_om = ObjectManager { Interest { type = "node" } }

function owns (client, node_id)
  if node_id == nil then
    return false
  end
  local node = nodes_om:lookup {
    Constraint { "bound-id", "=", tonumber (node_id), type = "gobject" }
  }
  return node ~= nil and tonumber (node.properties ["client.id"]) == client ["bound-id"]
end

function kind_of (properties)
  if properties ["link.output.node"] ~= nil then
    return "link"
  elseif properties ["port.direction"] ~= nil then
    return "port"
  elseif properties ["node.name"] ~= nil or properties ["media.class"] ~= nil then
    return "node"
  end
  return nil
end

function own_object (client, object, kind)
  local properties = object.properties or {}
  if kind == "node" then
    return tonumber (properties ["client.id"]) == client ["bound-id"]
  elseif kind == "port" then
    return owns (client, properties ["node.id"])
  elseif kind == "link" then
    return owns (client, properties ["link.output.node"]) or owns (client, properties ["link.input.node"])
  end
  return false
end

if PermissionManager ~= nil then
  application_pm = PermissionManager ()
  application_pm:set_default_permissions (Perm.NONE)
  application_pm:set_core_permissions (Perm.RWX)
  -- Its own client: pipewire-pulse answers a client with that object's index,
  -- and libpulse drops a connection without one.
  application_pm:add_interest_match (function (_, client, object)
    return object ["bound-id"] == client ["bound-id"] and Perm.RX or Perm.NONE
  end, Interest { type = "client" })
  for _, kind in ipairs { "node", "port", "link" } do
    application_pm:add_interest_match (function (_, client, object)
      return own_object (client, object, kind) and Perm.RWX or Perm.NONE
    end, Interest { type = kind })
  end
  application_pm:add_interest_match_simple (Perm.RX, Interest {
    type = "factory", Constraint { "factory.name", "=", "client-node" } })
  application_pm:add_interest_match_simple (Perm.R, Interest {
    type = "metadata", Constraint { "metadata.name", "c", "default", "settings" } })
  application_pm:add_interest_match_simple (Perm.RX, Interest {
    type = "node", Constraint { "media.class", "=", "Audio/Sink" } })
  -- The graph's own drivers, which clock a stream when no device does.
  application_pm:add_interest_match_simple (Perm.RX, Interest {
    type = "node", Constraint { "factory.name", "=", "support.node.driver" } })
  application_pm:add_interest_match (function (_, client, _)
    local _, _, app = viewed (client)
    return allowed (app) and Perm.RX or Perm.NONE
  end, Interest {
    type = "node", Constraint { "media.class", "c", "Audio/Source", "Audio/Source/Virtual", "Audio/Duplex" } })

  SimpleEventHook {
    name = "luma/application-sound/access",
    before = "client/find-config-access",
    interests = {
      EventInterest {
        Constraint { "event.type", "=", "select-access" },
      },
    },
    execute = function (event)
      local client = event:get_subject ()
      local application, kind, app = viewed (client)
      if not application then
        return
      end
      log:info (client, string.format ("application client (%s, %s): microphone %s",
          kind, tostring (app), allowed (app) and "allowed" or "not allowed"))
      event:set_data ("effective-access", ACCESS)
      event:set_data ("permission-manager", application_pm)
    end
  }:register ()

  application_pm:activate (Features.ALL, function (_, e)
    if e then
      log:warning ("failed to activate the application permission manager: " .. tostring (e))
    end
  end)

  function reapply ()
    application_pm:update_permissions ()
  end
else
  objects_om = ObjectManager {
    Interest { type = "node" },
    Interest { type = "port" },
    Interest { type = "link" },
    Interest { type = "factory" },
    Interest { type = "metadata" },
  }

  function object_permissions (object, app, client)
    local properties = object.properties or {}
    if own_object (client, object, kind_of (properties)) then
      return "rwx"
    end
    local class = properties ["media.class"]
    if class ~= nil then
      if class == "Audio/Sink" then
        return "rx"
      end
      if SOURCES [class] then
        return allowed (app) and "rx" or "-"
      end
      return nil
    end
    if properties ["factory.name"] == "client-node" or properties ["factory.name"] == "support.node.driver" then
      return "rx"
    end
    local name = properties ["metadata.name"]
    if name == "default" or name == "settings" then
      return "r"
    end
    return nil
  end

  function apply (client)
    local application, kind, app = viewed (client)
    if not application then
      return
    end
    local permissions = { ["any"] = "-", [0] = "rwx", [client ["bound-id"]] = "rx" }
    for object in objects_om:iterate () do
      local value = object_permissions (object, app, client)
      if value ~= nil then
        permissions [object ["bound-id"]] = value
      end
    end
    client:update_permissions (permissions)
    log:info (client, string.format ("application client (%s, %s): microphone %s",
        kind, tostring (app), allowed (app) and "allowed" or "not allowed"))
  end

  clients_om:connect ("object-added", function (_, client)
    apply (client)
  end)

  objects_om:connect ("object-added", function (_, object)
    for client in clients_om:iterate () do
      local application, _, app = viewed (client)
      if application then
        local value = object_permissions (object, app, client)
        if value ~= nil then
          client:update_permissions { [object ["bound-id"]] = value }
        end
      end
    end
  end)

  function reapply ()
    for client in clients_om:iterate () do
      apply (client)
    end
  end

  objects_om:activate ()
end

function client_of (node)
  local id = node.properties ["client.id"]
  if id == nil then
    return nil
  end
  return clients_om:lookup {
    Constraint { "bound-id", "=", id, type = "gobject" }
  }
end

refusals = ImplMetadata ("luma-application-refusals")
refusals:activate (Features.ALL, function (_, e)
  if e then
    log:warning ("cannot create the luma-application-refusals metadata: " .. tostring (e))
  end
end)

function refuse (client, node, kind, app, why)
  log:info (client, string.format ("recording refused (%s, %s): %s", kind, tostring (app), why))
  client:send_error (node ["bound-id"], -13, "recording needs the microphone permission")
  if app ~= nil then
    refusals:set (0, app, "Spa:String:JSON", "{\"what\":\"microphone\"}")
  end
end

-- A withdrawn grant ends the recordings already open. The stream node is
-- destroyed, not sent an error: pipewire-pulse tells its client a destroyed
-- stream was killed, and drops an errored one without a word.
function withdraw ()
  for node in streams_om:iterate () do
    local client = client_of (node)
    if client ~= nil then
      local kind, app = identity (client.properties)
      if kind ~= nil and not allowed (app) then
        log:info (client, string.format ("recording ended (%s, %s): permission withdrawn", kind, tostring (app)))
        node:request_destroy ()
      end
    end
  end
end

if pps ~= nil then
  pps:connect ("changed", function (_, table, id, deleted, permissions)
    if table ~= "devices" or id ~= "microphone" then
      return
    end
    microphone = (not deleted and permissions) or {}
    microphone_loaded = true
    reapply ()
    withdraw ()
  end)
else
  log:warning ("no permission store: applications may not record")
end

-- Every recording stream passes here before a source is chosen. A sound
-- output's monitor is a source too: recording what the computer plays needs
-- the same permission.
SimpleEventHook {
  name = "luma/application-sound/capture",
  before = "linking/find-defined-target",
  interests = {
    EventInterest {
      Constraint { "event.type", "=", "select-target" },
    },
  },
  execute = function (event)
    local _, _, si, si_props = lutils:unwrap_select_target_event (event)
    if si_props ["item.node.direction"] ~= "input" then
      return
    end
    local node = si:get_associated_proxy ("node")
    local client = node and client_of (node)
    if client == nil then
      return
    end
    local kind, app = identity (client.properties)
    if kind == nil or allowed (app) then
      return
    end
    event:set_data ("target", nil)
    refuse (client, node, kind, app, tostring (si_props ["node.name"]))
    event:stop_processing ()
  end
}:register ()

nodes_om:activate ()
clients_om:activate ()
streams_om:activate ()
