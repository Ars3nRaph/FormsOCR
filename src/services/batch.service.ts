
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { ocrService } from './ocr.service';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface BatchJobData {
  projectId: string;
  userId: string;
  name: string;
  processingOptions: {
    engine?: string;
    outputFormat?: string;
    confidenceThreshold?: number;
    languages?: string;
  };
}

export class BatchService {
  async createBatchJob(data: BatchJobData) {
    try {
      // Create batch job in database
      const { data: batchJob, error } = await supabase
        .from('batch_jobs')
        .insert({
          project_id: data.projectId,
          user_id: data.userId,
          name: data.name,
          status: 'pending',
          processing_options: data.processingOptions
        })
        .select()
        .single();

      if (error) {
        throw new ApiError('Failed to create batch job', 500);
      }

      logger.info(`Created batch job ${batchJob.id} for user ${data.userId}`);

      return {
        id: batchJob.id,
        name: batchJob.name,
        status: batchJob.status,
        projectId: batchJob.project_id,
        createdAt: batchJob.created_at
      };

    } catch (error) {
      logger.error('Batch job creation failed:', error);
      throw error;
    }
  }

  async getBatchStatus(batchId: string, userId: string) {
    try {
      const { data: batchJob, error } = await supabase
        .from('batch_jobs')
        .select(`
          *,
          batch_documents (
            id,
            filename,
            status,
            error_message,
            processed_at
          )
        `)
        .eq('id', batchId)
        .eq('user_id', userId)
        .single();

      if (error || !batchJob) {
        throw new ApiError('Batch job not found', 404);
      }

      return {
        id: batchJob.id,
        name: batchJob.name,
        status: batchJob.status,
        totalDocuments: batchJob.total_documents,
        processedDocuments: batchJob.processed_documents,
        failedDocuments: batchJob.failed_documents,
        startedAt: batchJob.started_at,
        completedAt: batchJob.completed_at,
        documents: batchJob.batch_documents,
        processingOptions: batchJob.processing_options,
        errorMessage: batchJob.error_message
      };

    } catch (error) {
      logger.error('Batch status retrieval failed:', error);
      throw error;
    }
  }

  async getBatchResults(batchId: string, userId: string) {
    try {
      const { data: batchJob, error } = await supabase
        .from('batch_jobs')
        .select(`
          *,
          batch_documents (
            id,
            filename,
            extracted_data,
            confidence_scores,
            processing_time,
            status
          )
        `)
        .eq('id', batchId)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .single();

      if (error || !batchJob) {
        throw new ApiError('Batch job not found or not completed', 404);
      }

      // Filter only completed documents
      const completedDocuments = batchJob.batch_documents.filter(
        (doc: any) => doc.status === 'completed'
      );

      return {
        id: batchJob.id,
        name: batchJob.name,
        completedAt: batchJob.completed_at,
        resultsUrl: batchJob.results_url,
        totalDocuments: batchJob.total_documents,
        processedDocuments: batchJob.processed_documents,
        failedDocuments: batchJob.failed_documents,
        documents: completedDocuments.map((doc: any) => ({
          id: doc.id,
          filename: doc.filename,
          extractedData: doc.extracted_data,
          confidenceScores: doc.confidence_scores,
          processingTime: doc.processing_time
        }))
      };

    } catch (error) {
      logger.error('Batch results retrieval failed:', error);
      throw error;
    }
  }

  async cancelBatchJob(batchId: string, userId: string) {
    try {
      const { data: batchJob, error } = await supabase
        .from('batch_jobs')
        .update({ status: 'cancelled' })
        .eq('id', batchId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) {
        throw new ApiError('Failed to cancel batch job or job not found', 404);
      }

      logger.info(`Cancelled batch job ${batchId} for user ${userId}`);

      return true;

    } catch (error) {
      logger.error('Batch job cancellation failed:', error);
      throw error;
    }
  }

  async getUserBatchJobs(userId: string) {
    try {
      const { data: batchJobs, error } = await supabase
        .from('batch_jobs')
        .select(`
          id,
          name,
          status,
          total_documents,
          processed_documents,
          failed_documents,
          created_at,
          started_at,
          completed_at,
          project_id
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw new ApiError('Failed to retrieve batch jobs', 500);
      }

      return batchJobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        totalDocuments: job.total_documents,
        processedDocuments: job.processed_documents,
        failedDocuments: job.failed_documents,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        projectId: job.project_id
      }));

    } catch (error) {
      logger.error('User batch jobs retrieval failed:', error);
      throw error;
    }
  }

  async processBatch(batchId: string) {
    try {
      // Get batch job and its documents
      const { data: batchJob, error: batchError } = await supabase
        .from('batch_jobs')
        .select(`
          *,
          projects (
            id,
            rois (*)
          ),
          batch_documents (*)
        `)
        .eq('id', batchId)
        .single();

      if (batchError || !batchJob) {
        throw new ApiError('Batch job not found', 404);
      }

      // Update batch status to processing
      await supabase
        .from('batch_jobs')
        .update({ 
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', batchId);

      const documents = batchJob.batch_documents;
      const rois = batchJob.projects.rois;

      // Process documents with concurrency limit
      const concurrencyLimit = 3;
      for (let i = 0; i < documents.length; i += concurrencyLimit) {
        const batch = documents.slice(i, i + concurrencyLimit);
        
        const batchPromises = batch.map(async (document: any) => {
          try {
            // Process document with OCR
            const result = await ocrService.processDocument(document.file_url, {
              rois,
              engine: batchJob.processing_options.engine || 'tesseract',
              confidenceThreshold: batchJob.processing_options.confidenceThreshold || 0.7,
              languages: batchJob.processing_options.languages || 'eng+fra'
            });

            // Update document with results
            await supabase
              .from('batch_documents')
              .update({
                status: 'completed',
                extracted_data: result.extractedData,
                confidence_scores: result.confidenceScores,
                processing_time: result.processingTime,
                processed_at: new Date().toISOString()
              })
              .eq('id', document.id);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            logger.error(`Document processing failed for ${document.id}:`, error);
            
            await supabase
              .from('batch_documents')
              .update({
                status: 'failed',
                error_message: errorMessage,
                processed_at: new Date().toISOString()
              })
              .eq('id', document.id);
          }
        });

        await Promise.all(batchPromises);
      }

      // Update batch job completion
      const { data: finalStats } = await supabase
        .from('batch_documents')
        .select('status')
        .eq('batch_job_id', batchId);

      const completed = finalStats?.filter(doc => doc.status === 'completed').length || 0;
      const failed = finalStats?.filter(doc => doc.status === 'failed').length || 0;

      await supabase
        .from('batch_jobs')
        .update({
          status: 'completed',
          processed_documents: completed,
          failed_documents: failed,
          completed_at: new Date().toISOString()
        })
        .eq('id', batchId);

      logger.info(`Batch processing completed for ${batchId}. Processed: ${completed}, Failed: ${failed}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Batch processing failed:', error);
      
      // Update batch job with error
      await supabase
        .from('batch_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', batchId);

      throw error;
    }
  }
}

export const batchService = new BatchService();