SELECT
    interviews.id AS interviews_id,
    interviews.application_id AS interviews_application_id,
    interviews.interview_token AS interviews_interview_token,
    interviews.token_expires_at AS interviews_token_expires_at,
    interviews.scheduled_at AS interviews_scheduled_at,
    interviews.candidate_availability AS interviews_candidate_availability,
    interviews.booking_link AS interviews_booking_link,
    interviews.status AS interviews_status,
    interviews.interview_type AS interviews_interview_type,
    interviews.time_limit_minutes AS interviews_time_limit_minutes,
    interviews.started_at AS interviews_started_at,
    interviews.transcript AS interviews_transcript,
    interviews.questions_asked AS interviews_questions_asked,
    interviews.interview_score AS interviews_interview_score,
    interviews.interview_feedback AS interviews_interview_feedback,
    interviews.interview_topics AS interviews_interview_topics,
    interviews.interview_duration_minutes AS interviews_interview_duration_minutes,
    interviews.recording_url AS interviews_recording_url,
    interviews.recording_web_url AS interviews_recording_web_url,
    interviews.recording_status AS interviews_recording_status,
    interviews.ai_summary AS interviews_ai_summary,
    interviews.ai_strengths AS interviews_ai_strengths,
    interviews.ai_weaknesses AS interviews_ai_weaknesses,
    interviews.ai_improvements AS interviews_ai_improvements,
    interviews.completed_at AS interviews_completed_at,
    interviews.created_at AS interviews_created_at,
    interviews.updated_at AS interviews_updated_at
FROM
    interviews
    INNER JOIN applications ON applications.id = interviews.application_id
    INNER JOIN jobs ON jobs.id = applications.job_id
WHERE
    jobs.company_id = '2dc265ca-e5fa-470a-95e5-15e26e8f0f63'
ORDER BY interviews.created_at DESC
LIMIT 0, 100;