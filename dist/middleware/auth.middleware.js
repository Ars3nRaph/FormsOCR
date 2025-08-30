"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionMiddleware = exports.authMiddleware = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errors_1.ApiError('No valid authorization token provided', 401);
        }
        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            throw new errors_1.ApiError('Invalid or expired token', 401);
        }
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        if (profileError || !profile) {
            throw new errors_1.ApiError('User profile not found', 404);
        }
        req.user = user;
        req.profile = profile;
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication error:', error);
        if (error instanceof errors_1.ApiError) {
            next(error);
        }
        else {
            next(new errors_1.ApiError('Authentication failed', 401));
        }
    }
};
exports.authMiddleware = authMiddleware;
const subscriptionMiddleware = (requiredTier) => {
    return (req, res, next) => {
        const profile = req.profile;
        if (!profile) {
            return next(new errors_1.ApiError('User profile required', 401));
        }
        if (profile.subscription_status !== 'active' && profile.subscription_tier !== 'free') {
            return next(new errors_1.ApiError('Active subscription required', 403));
        }
        if (requiredTier) {
            const tierHierarchy = ['free', 'niv1', 'niv2', 'pro'];
            const userTierIndex = tierHierarchy.indexOf(profile.subscription_tier);
            const requiredTierIndex = tierHierarchy.indexOf(requiredTier);
            if (userTierIndex < requiredTierIndex) {
                return next(new errors_1.ApiError(`${requiredTier} subscription or higher required`, 403));
            }
        }
        next();
    };
};
exports.subscriptionMiddleware = subscriptionMiddleware;
