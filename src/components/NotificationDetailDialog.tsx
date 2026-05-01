import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Share2, ZoomIn, X } from "lucide-react";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";

interface Props {
  notification: AppNotification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NotificationDetailDialog = ({ notification, open, onOpenChange }: Props) => {
  const { markClicked } = useNotifications();
  const navigate = useNavigate();
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!notification) return null;

  const handleLinkClick = () => {
    if (!notification.link_url) return;
    markClicked(notification.id);
    if (notification.link_url.startsWith("http")) {
      window.open(notification.link_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(notification.link_url);
      onOpenChange(false);
    }
  };

  const handleWhatsAppShare = () => {
    const parts = [
      `*${notification.title}*`,
      notification.message,
      notification.image_url || "",
      notification.link_url
        ? `${notification.link_label || "More info"}: ${
            notification.link_url.startsWith("http")
              ? notification.link_url
              : `${window.location.origin}${notification.link_url}`
          }`
        : "",
    ].filter(Boolean);
    const text = encodeURIComponent(parts.join("\n\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{notification.title}</DialogTitle>
        </DialogHeader>
        {notification.image_url && (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="relative group rounded-md border overflow-hidden"
            aria-label="Expand image"
          >
            <img
              src={notification.image_url}
              alt={notification.title}
              className="w-full max-h-64 object-contain bg-muted"
            />
            <span className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded-full p-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-4 w-4 text-foreground" />
            </span>
          </button>
        )}
        <p className="text-sm text-foreground whitespace-pre-wrap">{notification.message}</p>
        <div className="flex flex-wrap gap-2">
          {notification.link_url && (
            <Button className="flex-1" onClick={handleLinkClick}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {notification.link_label || "Open Link"}
            </Button>
          )}
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleWhatsAppShare}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share on WhatsApp
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    {notification.image_url && (
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl p-2 bg-background/95">
          <DialogHeader className="sr-only">
            <DialogTitle>{notification.title}</DialogTitle>
          </DialogHeader>
          <button
            onClick={() => setZoomOpen(false)}
            className="absolute top-2 right-2 z-10 rounded-full bg-background/80 p-1.5 hover:bg-background"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <img
            src={notification.image_url}
            alt={notification.title}
            className="w-full max-h-[85vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
};

export default NotificationDetailDialog;
