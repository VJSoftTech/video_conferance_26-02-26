import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  X,
  Crown,
  MicOff,
  VideoOff,
  Lock,
  Unlock,
  UserX,
  Hand,
  Users,
  Shield,
  Settings,
  Volume2,
  VolumeX,
  Camera,
  CameraOff,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface HostControlsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  participantCount: number;
  isRoomLocked: boolean;
  onMuteAll: () => void;
  onDisableAllCameras: () => void;
  onToggleRoomLock: () => void;
  onEndMeeting: () => void;
}

export function HostControlsPanel({
  isOpen,
  onClose,
  roomId,
  participantCount,
  isRoomLocked,
  onMuteAll,
  onDisableAllCameras,
  onToggleRoomLock,
  onEndMeeting,
}: HostControlsPanelProps) {
  const [showEndMeetingDialog, setShowEndMeetingDialog] = useState(false);
  const [allowParticipantsUnmute, setAllowParticipantsUnmute] = useState(true);
  const [allowParticipantsVideo, setAllowParticipantsVideo] = useState(true);
  const [allowScreenShare, setAllowScreenShare] = useState(true);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      
      <div className={cn(
        "fixed right-0 top-0 h-[calc(100%-5rem)] w-full max-w-sm bg-card/95 backdrop-blur-xl border-l shadow-2xl z-40",
        "transform transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-amber-500/10 to-orange-500/10">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-amber-500/20">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Host Controls</h2>
                <p className="text-xs text-muted-foreground">Room: {roomId}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Participants
                </span>
                <Badge variant="secondary">{participantCount}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isRoomLocked ? "bg-red-500" : "bg-green-500"
                )} />
                <span className="text-xs text-muted-foreground">
                  {isRoomLocked ? "Room Locked" : "Room Open"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Radio className="w-4 h-4" />
                Quick Actions
              </h3>
              
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={onMuteAll}
              >
                <div className="p-1.5 rounded bg-red-500/10">
                  <MicOff className="w-4 h-4 text-red-500" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Mute All</div>
                  <div className="text-xs text-muted-foreground">Mute all participants</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={onDisableAllCameras}
              >
                <div className="p-1.5 rounded bg-orange-500/10">
                  <VideoOff className="w-4 h-4 text-orange-500" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Disable All Cameras</div>
                  <div className="text-xs text-muted-foreground">Turn off all video</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start gap-3 h-12",
                  isRoomLocked && "border-red-500/50"
                )}
                onClick={onToggleRoomLock}
              >
                <div className={cn(
                  "p-1.5 rounded",
                  isRoomLocked ? "bg-red-500/10" : "bg-green-500/10"
                )}>
                  {isRoomLocked ? (
                    <Lock className="w-4 h-4 text-red-500" />
                  ) : (
                    <Unlock className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-medium">
                    {isRoomLocked ? "Unlock Room" : "Lock Room"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isRoomLocked ? "Allow new participants" : "Prevent new joins"}
                  </div>
                </div>
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4" />
                Participant Permissions
              </h3>

              <div className="space-y-4 bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Allow Unmute</div>
                      <div className="text-xs text-muted-foreground">Participants can unmute themselves</div>
                    </div>
                  </div>
                  <Switch
                    checked={allowParticipantsUnmute}
                    onCheckedChange={setAllowParticipantsUnmute}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Allow Video</div>
                      <div className="text-xs text-muted-foreground">Participants can enable camera</div>
                    </div>
                  </div>
                  <Switch
                    checked={allowParticipantsVideo}
                    onCheckedChange={setAllowParticipantsVideo}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Allow Screen Share</div>
                      <div className="text-xs text-muted-foreground">Participants can share screen</div>
                    </div>
                  </div>
                  <Switch
                    checked={allowScreenShare}
                    onCheckedChange={setAllowScreenShare}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4" />
                Danger Zone
              </h3>
              
              <Button
                variant="destructive"
                className="w-full justify-start gap-3 h-12"
                onClick={() => setShowEndMeetingDialog(true)}
              >
                <UserX className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-medium">End Meeting for All</div>
                  <div className="text-xs opacity-80">Disconnect all participants</div>
                </div>
              </Button>
            </div>
          </div>

          <div className="p-4 border-t bg-muted/30">
            <p className="text-xs text-center text-muted-foreground">
              As host, you have full control over this meeting
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={showEndMeetingDialog} onOpenChange={setShowEndMeetingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Meeting for All?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect all participants from the meeting. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onEndMeeting();
                setShowEndMeetingDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              End Meeting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
