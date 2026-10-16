import mongoose from 'mongoose';

/**
 * Tests: applications to conduct tests on Tectum (as a person or an organisation such as a
 * coaching institute), and members' registrations for a listed test.
 *
 * Hosting: a member applies (at sign-up or from the Tests page), an admin approves or rejects it in
 * Moderation > Quiz hosts, and User.quizHost follows the decision. The first FREE_HOSTED_TESTS
 * published tests are free; later ones carry an upload charge (agreed in the application, collected
 * by Tectum outside the site for now).
 *
 * Registration: tests listed on the host's profile are taken by registering (name, college); the
 * host accepts each request, which lets that member open the test once it is live.
 */
export const FREE_HOSTED_TESTS = 2;
export const HOST_APPLICATION_STATUSES = ['pending', 'approved', 'rejected'];
export const REGISTRATION_STATUSES = ['pending', 'accepted', 'rejected'];
const { ObjectId } = mongoose.Schema.Types;
const S = (max) => ({ type: String, trim: true, maxlength: max, default: '' });

const applicationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    orgName: { type: String, trim: true, maxlength: 120, required: true },
    about: S(1000), // what tests, for whom
    phone: S(30),
    website: S(300),
    // the hosting terms (2 free tests, then a charge per test) were accepted
    acceptedTermsAt: { type: Date, required: true },
    status: { type: String, enum: HOST_APPLICATION_STATUSES, default: 'pending', index: true },
    decidedBy: { type: ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    note: S(300), // the admin's reason, sent to the applicant
  },
  { timestamps: true }
);

export const QuizHostApplication = mongoose.model('QuizHostApplication', applicationSchema);

const registrationSchema = new mongoose.Schema(
  {
    quiz: { type: ObjectId, ref: 'Quiz', required: true },
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, trim: true, maxlength: 80, required: true },
    college: { type: String, trim: true, maxlength: 150, required: true },
    status: { type: String, enum: REGISTRATION_STATUSES, default: 'pending' },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);
registrationSchema.index({ quiz: 1, user: 1 }, { unique: true });
registrationSchema.index({ quiz: 1, status: 1, createdAt: 1 });

export const QuizRegistration = mongoose.model('QuizRegistration', registrationSchema);
