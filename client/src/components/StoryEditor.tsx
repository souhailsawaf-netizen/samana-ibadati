import type { DailyStory } from "@shared/stories";

type StoryEditorProps = {
  stories: DailyStory[];
  disabled: boolean;
  onChange: (stories: DailyStory[]) => void;
};

export function StoryEditor({ stories, disabled, onChange }: StoryEditorProps) {
  const updateStory = (
    index: number,
    field: keyof DailyStory,
    value: string
  ) => {
    onChange(
      stories.map((story, storyIndex) =>
        storyIndex === index ? { ...story, [field]: value } : story
      )
    );
  };

  return (
    <section className="story-editor" aria-labelledby="story-editor-title">
      <div className="section-heading" style={{ marginTop: 0 }}>
        <h3 id="story-editor-title">قصص البرنامج اليومية</h3>
        <span className="section-count">٣٠ قصة</span>
      </div>
      <p className="muted">
        افتح القصة التي تريدها وعدّل عنوانها ونصها وخلاصتها، ثم احفظ إعدادات
        البرنامج. تصل التعديلات للطلاب تلقائيًا.
      </p>
      <div className="story-edit-list">
        {stories.map((story, index) => (
          <details className="story-edit-item" key={index + 1}>
            <summary>
              <span>القصة {index + 1}</span>
              <strong>{story.title || "أدخل عنوانًا للقصة"}</strong>
            </summary>
            <div className="story-edit-fields">
              <div className="field">
                <label htmlFor={`story-title-${index}`}>عنوان القصة</label>
                <input
                  id={`story-title-${index}`}
                  value={story.title}
                  maxLength={120}
                  disabled={disabled}
                  onChange={event =>
                    updateStory(index, "title", event.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={`story-body-${index}`}>نص القصة</label>
                <textarea
                  id={`story-body-${index}`}
                  value={story.body}
                  maxLength={1000}
                  rows={4}
                  disabled={disabled}
                  onChange={event =>
                    updateStory(index, "body", event.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={`story-takeaway-${index}`}>الخلاصة</label>
                <textarea
                  id={`story-takeaway-${index}`}
                  value={story.takeaway}
                  maxLength={240}
                  rows={2}
                  disabled={disabled}
                  onChange={event =>
                    updateStory(index, "takeaway", event.target.value)
                  }
                />
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
