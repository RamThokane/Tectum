import mongoose from 'mongoose';

/** A member's private note on a post they saved to their Notebook. Only they can see it. */
const notebookNoteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true }
);

notebookNoteSchema.index({ user: 1, post: 1 }, { unique: true });

export const NotebookNote = mongoose.model('NotebookNote', notebookNoteSchema);
