import { useQuery, useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type LiveKitTokenRequest } from "@shared/schema";

// Hook to check if LiveKit is configured correctly
export function useLiveKitStatus() {
  return useQuery({
    queryKey: [api.livekit.status.path],
    queryFn: async () => {
      const res = await fetch(api.livekit.status.path);
      if (!res.ok) throw new Error("Failed to fetch status");
      return api.livekit.status.responses[200].parse(await res.json());
    },
  });
}

// Hook to generate a LiveKit token for joining a room
export function useLiveKitToken() {
  return useMutation({
    mutationFn: async (data: LiveKitTokenRequest) => {
      const validated = api.livekit.token.input.parse(data);
      const res = await fetch(api.livekit.token.path, {
        method: api.livekit.token.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.livekit.token.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        if (res.status === 500) {
          const error = api.livekit.token.responses[500].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to generate token");
      }

      return api.livekit.token.responses[200].parse(await res.json());
    },
  });
}

// Optional: Hook to fetch room details from DB (if persistence is used)
export function useRoom(id: string) {
  return useQuery({
    queryKey: [api.rooms.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.rooms.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch room");
      return api.rooms.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}
