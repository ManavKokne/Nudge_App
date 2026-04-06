import { LoaderCircle, PencilLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function PostActionsCard({
  currentContent,
  editContent,
  isDeletingPost,
  isEditing,
  isOwner,
  isSavingPost,
  onCancelEdit,
  onDeletePost,
  onEditContentChange,
  onSaveEdit,
  onStartEdit,
}) {
  if (!isOwner) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Post Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea value={editContent} onChange={(event) => onEditContentChange(event.target.value)} maxLength={3000} />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={onSaveEdit} disabled={isSavingPost}>
                {isSavingPost ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                Save Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onCancelEdit(currentContent || "");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={onStartEdit}>
              <PencilLine className="h-4 w-4" />
              Edit Post
            </Button>
            <Button type="button" variant="danger" onClick={onDeletePost} disabled={isDeletingPost}>
              {isDeletingPost ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Post
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
