"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Reply, Send, Edit, Trash2, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface Comment {
    id: string;
    content: string;
    orderId: string;
    userId: string;
    parentCommentId?: string;
    isInternal: boolean;
    createdAt: string;
    updatedAt: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    replies?: Comment[];
}

interface OrderCommentsProps {
    orderId: string;
    userRole: string;
    userId: string;
    comments: Comment[];
    onAddComment: (content: string, parentId?: string, isInternal?: boolean) => Promise<void>;
    onUpdateComment: (commentId: string, content: string) => Promise<void>;
    onDeleteComment: (commentId: string) => Promise<void>;
}

export function OrderComments({
    orderId,
    userRole,
    userId,
    comments,
    onAddComment,
    onUpdateComment,
    onDeleteComment,
}: OrderCommentsProps) {
    const [newComment, setNewComment] = useState("");
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [editingComment, setEditingComment] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
        }
    }, [newComment]);

    const handleSubmitComment = async () => {
        if (!newComment.trim()) return;

        setIsSubmitting(true);
        try {
            await onAddComment(newComment, undefined, isInternal);
            setNewComment("");
            setIsInternal(false);
            toast.success("Comment added successfully");
        } catch (error) {
            toast.error("Failed to add comment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitReply = async (parentId: string) => {
        if (!replyContent.trim()) return;

        setIsSubmitting(true);
        try {
            await onAddComment(replyContent, parentId, isInternal);
            setReplyContent("");
            setReplyingTo(null);
            setIsInternal(false);
            toast.success("Reply added successfully");
        } catch (error) {
            toast.error("Failed to add reply");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateComment = async (commentId: string) => {
        if (!editContent.trim()) return;

        setIsSubmitting(true);
        try {
            await onUpdateComment(commentId, editContent);
            setEditingComment(null);
            setEditContent("");
            toast.success("Comment updated successfully");
        } catch (error) {
            toast.error("Failed to update comment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            await onDeleteComment(commentId);
            toast.success("Comment deleted successfully");
        } catch (error) {
            toast.error("Failed to delete comment");
        }
    };

    const startEditing = (comment: Comment) => {
        setEditingComment(comment.id);
        setEditContent(comment.content);
    };

    const cancelEditing = () => {
        setEditingComment(null);
        setEditContent("");
    };

    const canEditComment = (comment: Comment) => {
        return comment.userId === userId || userRole === "admin";
    };

    const canDeleteComment = (comment: Comment) => {
        return comment.userId === userId || userRole === "admin";
    };

    const canViewInternalComments = () => {
        return ["admin", "accountant", "warehouse", "shipper"].includes(userRole);
    };

    const filteredComments = comments.filter(comment => {
        if (comment.isInternal && !canViewInternalComments()) {
            return false;
        }
        return true;
    });

    const organizeComments = (comments: Comment[]) => {
        const commentMap = new Map<string, Comment>();
        const rootComments: Comment[] = [];

        // First pass: create map and identify root comments
        comments.forEach(comment => {
            commentMap.set(comment.id, { ...comment, replies: [] });
            if (!comment.parentCommentId) {
                rootComments.push(commentMap.get(comment.id)!);
            }
        });

        // Second pass: organize replies
        comments.forEach(comment => {
            if (comment.parentCommentId) {
                const parent = commentMap.get(comment.parentCommentId);
                if (parent) {
                    parent.replies!.push(commentMap.get(comment.id)!);
                }
            }
        });

        return rootComments.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    };

    const organizedComments = organizeComments(filteredComments);

    const renderComment = (comment: Comment, isReply = false) => (
        <div key={comment.id} className={`${isReply ? "ml-8 mt-3" : ""}`}>
            <div className="flex gap-3">
                <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">
                        {comment.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{comment.user.name}</span>
                                <Badge variant="outline" className="text-xs">
                                    {comment.user.role}
                                </Badge>
                                {comment.isInternal && (
                                    <Badge variant="secondary" className="text-xs">
                                        Internal
                                    </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                </span>
                                {comment.updatedAt !== comment.createdAt && (
                                    <span className="text-xs text-muted-foreground">(edited)</span>
                                )}
                            </div>
                            
                            {(canEditComment(comment) || canDeleteComment(comment)) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                            <MoreVertical className="w-3 h-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {canEditComment(comment) && (
                                            <DropdownMenuItem onClick={() => startEditing(comment)}>
                                                <Edit className="w-3 h-3 mr-2" />
                                                Edit
                                            </DropdownMenuItem>
                                        )}
                                        {canDeleteComment(comment) && (
                                            <DropdownMenuItem 
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="text-red-600"
                                            >
                                                <Trash2 className="w-3 h-3 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        
                        {editingComment === comment.id ? (
                            <div className="space-y-2">
                                <Textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="min-h-[60px]"
                                />
                                <div className="flex gap-2">
                                    <Button 
                                        size="sm" 
                                        onClick={() => handleUpdateComment(comment.id)}
                                        disabled={isSubmitting}
                                    >
                                        Save
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={cancelEditing}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                                
                                {!isReply && (
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs"
                                            onClick={() => setReplyingTo(comment.id)}
                                        >
                                            <Reply className="w-3 h-3 mr-1" />
                                            Reply
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Reply form */}
                    {replyingTo === comment.id && (
                        <div className="mt-3 ml-3">
                            <div className="space-y-2">
                                <Textarea
                                    placeholder="Write a reply..."
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    className="min-h-[60px]"
                                />
                                {canViewInternalComments() && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id={`internal-reply-${comment.id}`}
                                            checked={isInternal}
                                            onChange={(e) => setIsInternal(e.target.checked)}
                                            className="rounded"
                                        />
                                        <label htmlFor={`internal-reply-${comment.id}`} className="text-xs">
                                            Internal comment (only visible to staff)
                                        </label>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <Button 
                                        size="sm" 
                                        onClick={() => handleSubmitReply(comment.id)}
                                        disabled={isSubmitting}
                                    >
                                        <Send className="w-3 h-3 mr-1" />
                                        Reply
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => {
                                            setReplyingTo(null);
                                            setReplyContent("");
                                            setIsInternal(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-3">
                            {comment.replies
                                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                                .map(reply => renderComment(reply, true))
                            }
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Comments ({organizedComments.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* New comment form */}
                <div className="space-y-3">
                    <Textarea
                        ref={textareaRef}
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[80px] resize-none"
                    />
                    {canViewInternalComments() && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="internal-comment"
                                checked={isInternal}
                                onChange={(e) => setIsInternal(e.target.checked)}
                                className="rounded"
                            />
                            <label htmlFor="internal-comment" className="text-sm">
                                Internal comment (only visible to staff)
                            </label>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <Button 
                            onClick={handleSubmitComment}
                            disabled={!newComment.trim() || isSubmitting}
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Add Comment
                        </Button>
                    </div>
                </div>

                <Separator />

                {/* Comments list */}
                <div className="space-y-4">
                    {organizedComments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No comments yet. Be the first to add one!
                        </div>
                    ) : (
                        organizedComments.map(comment => renderComment(comment))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
